"""
BioSemantica - Production Flask API
Multimodal search: Text, Images (descriptions), Sequences, Experiments
NO Docker, NO virtualenv needed - Direct deployment
"""

from flask import Flask, request, jsonify, send_file
from flask_cors import CORS
import json
import numpy as np
from typing import List, Dict, Any, Optional, Union
import warnings
warnings.filterwarnings('ignore')

# Vector database
from qdrant_client import QdrantClient
from qdrant_client.models import (
    Distance, VectorParams, PointStruct, Filter,
    FieldCondition, MatchValue, PayloadSchemaType
)

# Embeddings
import torch
from transformers import CLIPProcessor, CLIPModel
from PIL import Image
import io
import base64

# Text chunking
try:
    from chonkie import FastChunker
except ImportError:
    # Fallback chunker if chonkie not available
    class FastChunker:
        def __init__(self, chunk_size=512, delimiters=None):
            self.chunk_size = chunk_size
        def chunk(self, text):
            words = text.split()
            chunks = []
            for i in range(0, len(words), self.chunk_size):
                chunk_text = ' '.join(words[i:i+self.chunk_size])
                chunks.append(type('obj', (object,), {'text': chunk_text}))
            return chunks

import os
import logging

# Setup logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# ============================================================================
# CONFIGURATION
# ============================================================================

QDRANT_URL = os.getenv('QDRANT_URL', 'https://6638cf80-266b-4b74-b8cc-aac14899c528.us-east4-0.gcp.cloud.qdrant.io')
QDRANT_API_KEY = os.getenv('QDRANT_API_KEY', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJhY2Nlc3MiOiJtIn0.xA63-tAtaxTSPSPtHU5DywVjpqrn-WhLK-Dn68PN35U')
COLLECTION_NAME = os.getenv('COLLECTION_NAME', 'biology_multimodal')

# ============================================================================
# MULTIMODAL RETRIEVER CLASS
# ============================================================================

class QdrantMultiModalRetriever:
    """
    Handles multimodal search across:
    - Text (research papers, protocols)
    - Images (described via text)
    - Sequences (DNA/RNA/Protein)
    - Experiments
    """
    
    def __init__(
        self,
        qdrant_url: str,
        qdrant_api_key: str,
        clip_model_name: str = "openai/clip-vit-base-patch32",
        collection_name: str = "biology_multimodal"
    ):
        self.client = QdrantClient(url=qdrant_url, api_key=qdrant_api_key)
        self.collection_name = collection_name
        
        # Load CLIP model
        logger.info(f"Loading CLIP model: {clip_model_name}")
        self.clip_model = CLIPModel.from_pretrained(clip_model_name)
        self.clip_processor = CLIPProcessor.from_pretrained(clip_model_name)
        self.embedding_dim = self.clip_model.config.projection_dim
        
        # Text chunker
        self.chunker = FastChunker(chunk_size=512, delimiters="\n.?")
        
        logger.info(f"✅ Retriever initialized (embedding_dim={self.embedding_dim})")
    
    def chunk_text(self, text: str) -> List[str]:
        """Split text into chunks"""
        chunks = self.chunker.chunk(text)
        return [chunk.text for chunk in chunks]
    
    def _embedding_to_vector(self, embedding: np.ndarray) -> List[float]:
        """Convert numpy embedding to list of floats"""
        if len(embedding.shape) > 1:
            embedding = embedding.flatten()
        return [float(x) for x in embedding]
    
    def encode_text(self, text: Union[str, List[str]]) -> np.ndarray:
        """Generate CLIP text embeddings"""
        if isinstance(text, str):
            text = [text]
        
        inputs = self.clip_processor(
            text=text, return_tensors="pt", padding=True, 
            truncation=True, max_length=77
        )
        
        with torch.no_grad():
            text_features = self.clip_model.get_text_features(**inputs)
            text_features = text_features / text_features.norm(p=2, dim=-1, keepdim=True)
        
        embeddings = text_features.cpu().numpy()
        if len(text) == 1 and len(embeddings.shape) == 2:
            embeddings = embeddings[0]
        
        return embeddings
    
    def search(
        self,
        query: str,
        top_k: int = 5,
        content_type_filter: Optional[str] = None,
        year_filter: Optional[int] = None
    ) -> List[Dict]:
        """
        Search the multimodal database
        
        Args:
            query: Search query text
            top_k: Number of results
            content_type_filter: 'text', 'image', 'sequence', 'experiment' or None
            year_filter: Filter by year
        
        Returns:
            List of search results with scores
        """
        filter_conditions = []
        
        # Filter by content type (output format)
        if content_type_filter:
            filter_conditions.append(
                FieldCondition(
                    key="content_type", 
                    match=MatchValue(value=content_type_filter)
                )
            )
        
        # Filter by year
        if year_filter is not None:
            filter_conditions.append(
                FieldCondition(
                    key="year",
                    match=MatchValue(value=year_filter)
                )
            )
        
        search_filter = Filter(must=filter_conditions) if filter_conditions else None
        
        # Generate query embedding
        query_embedding = self.encode_text(query)
        
        # Search Qdrant
        search_results = self.client.query_points(
            collection_name=self.collection_name,
            query=self._embedding_to_vector(query_embedding),
            limit=top_k,
            query_filter=search_filter
        ).points
        
        # Format results
        results = []
        for result in search_results:
            results.append({
                'id': str(result.id),
                'content': result.payload.get('content', ''),
                'score': float(result.score),
                'metadata': result.payload.get('metadata', {}),
                'content_type': result.payload.get('content_type', 'unknown'),
                'chunk_id': result.payload.get('chunk_id'),
                'description': result.payload.get('description', ''),
                'full_content': result.payload.get('full_content', '')
            })
        
        return results
    
    def get_collection_info(self) -> Dict:
        """Get collection statistics"""
        try:
            coll_info = self.client.get_collection(self.collection_name)
            
            # Count content types
            content_types = {}
            scroll_result = self.client.scroll(
                collection_name=self.collection_name,
                limit=1000,
                with_payload=True,
                with_vectors=False
            )
            
            for point in scroll_result[0]:
                ctype = point.payload.get('content_type', 'unknown')
                content_types[ctype] = content_types.get(ctype, 0) + 1
            
            return {
                'collection_name': self.collection_name,
                'total_points': coll_info.points_count,
                'status': str(coll_info.status),
                'vector_dimension': self.embedding_dim,
                'content_types': content_types
            }
        except Exception as e:
            return {'error': str(e)}

# ============================================================================
# FLASK APP
# ============================================================================

app = Flask(__name__)
CORS(app)  # Enable CORS for all routes

# Initialize retriever
try:
    retriever = QdrantMultiModalRetriever(
        qdrant_url=QDRANT_URL,
        qdrant_api_key=QDRANT_API_KEY,
        clip_model_name="openai/clip-vit-base-patch32",
        collection_name=COLLECTION_NAME
    )
    logger.info("✅ Retriever initialized successfully")
except Exception as e:
    logger.error(f"❌ Failed to initialize retriever: {e}")
    retriever = None

# ============================================================================
# API ENDPOINTS
# ============================================================================

@app.route('/health', methods=['GET'])
def health_check():
    """Health check endpoint"""
    return jsonify({
        'status': 'healthy',
        'retriever_loaded': retriever is not None,
        'collection': COLLECTION_NAME
    })

@app.route('/api/search', methods=['POST'])
def search():
    """
    Main search endpoint
    
    Request body:
    {
        "query": "search text",
        "top_k": 10,
        "output_type": "text" | "image" | "sequence" | "experiment" | null,
        "year": 2024
    }
    """
    try:
        data = request.get_json()
        
        if not data or 'query' not in data:
            return jsonify({'error': 'Query parameter required'}), 400
        
        query = data['query']
        top_k = data.get('top_k', 10)
        output_type = data.get('output_type')  # Filter by output format
        year = data.get('year')
        
        logger.info(f"Search: query='{query}', output_type={output_type}, year={year}")
        
        if not retriever:
            return jsonify({'error': 'Retriever not initialized'}), 500
        
        # Perform search
        results = retriever.search(
            query=query,
            top_k=top_k,
            content_type_filter=output_type,
            year_filter=year
        )
        
        return jsonify({
            'results': results,
            'query': query,
            'total_results': len(results),
            'filters': {
                'output_type': output_type,
                'year': year
            }
        })
        
    except Exception as e:
        logger.error(f"Search error: {e}")
        return jsonify({'error': str(e)}), 500

@app.route('/api/stats', methods=['GET'])
def get_stats():
    """Get collection statistics"""
    try:
        if not retriever:
            return jsonify({'error': 'Retriever not initialized'}), 500
        
        info = retriever.get_collection_info()
        return jsonify(info)
        
    except Exception as e:
        logger.error(f"Stats error: {e}")
        return jsonify({'error': str(e)}), 500

@app.route('/api/content-types', methods=['GET'])
def get_content_types():
    """Get available content types (output formats)"""
    return jsonify({
        'content_types': [
            {
                'value': 'text',
                'label': 'Text (Papers & Protocols)',
                'description': 'Research papers and experimental protocols'
            },
            {
                'value': 'image',
                'label': 'Images',
                'description': 'Microscopy images and visualizations'
            },
            {
                'value': 'sequence',
                'label': 'Sequences',
                'description': 'DNA, RNA, and protein sequences'
            },
            {
                'value': 'experiment',
                'label': 'Experiments',
                'description': 'Experimental data and results'
            }
        ]
    })

# ============================================================================
# RUN SERVER
# ============================================================================

if __name__ == '__main__':
    port = int(os.getenv('PORT', 8000))
    debug = os.getenv('DEBUG', 'False').lower() == 'true'
    
    logger.info(f"🚀 Starting server on port {port}")
    logger.info(f"Collection: {COLLECTION_NAME}")
    
    app.run(host='0.0.0.0', port=port, debug=debug)
