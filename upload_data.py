"""
Upload biological data to Qdrant
Run this ONCE after deploying backend
"""

import sys
import json
from app import QdrantMultiModalRetriever, QDRANT_URL, QDRANT_API_KEY, COLLECTION_NAME

print("="*60)
print("🧬 BioSemantica - Data Upload Script")
print("="*60)

# Initialize retriever
print("\n📡 Connecting to Qdrant...")
retriever = QdrantMultiModalRetriever(
    qdrant_url=QDRANT_URL,
    qdrant_api_key=QDRANT_API_KEY,
    clip_model_name="openai/clip-vit-base-patch32",
    collection_name=COLLECTION_NAME
)

# Create collection
print(f"\n📦 Creating collection: {COLLECTION_NAME}")
retriever.client.create_collection(
    collection_name=COLLECTION_NAME,
    vectors_config={
        'size': retriever.embedding_dim,
        'distance': 'Cosine'
    }
)

# Load data
data_file = '../data/biology_data.json'
print(f"\n📂 Loading data from: {data_file}")

try:
    with open(data_file, 'r') as f:
        data = json.load(f)
    print(f"✅ Loaded data successfully")
except FileNotFoundError:
    print(f"❌ File not found: {data_file}")
    print("Please make sure biology_data.json is in the data/ folder")
    sys.exit(1)

# Index data
print("\n🚀 Starting data indexing...")
print("This may take 2-3 minutes...")

retriever.index_data(data)

# Verify
print("\n✅ Indexing complete!")
print("\n📊 Collection Info:")

info = retriever.get_collection_info()
print(f"   Total points: {info.get('total_points', 0)}")
print(f"   Content types: {info.get('content_types', {})}")

print("\n" + "="*60)
print("✅ DATA UPLOAD COMPLETE!")
print("="*60)
print("\nYou can now use the search API:")
print(f"   POST {QDRANT_URL.replace('https://', 'https://YOUR-BACKEND.onrender.com')}/api/search")
print("\n🎉 Ready to go!")
