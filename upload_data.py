
import sys
import json
from app import QdrantMultiModalRetriever, QDRANT_URL, QDRANT_API_KEY, COLLECTION_NAME
retriever = QdrantMultiModalRetriever(
    qdrant_url=QDRANT_URL,
    qdrant_api_key=QDRANT_API_KEY,
    clip_model_name="openai/clip-vit-base-patch32",
    collection_name=COLLECTION_NAME
)
print(f"\n📦 Creating collection: {COLLECTION_NAME}")
retriever.client.create_collection(
    collection_name=COLLECTION_NAME,
    vectors_config={
        'size': retriever.embedding_dim,
        'distance': 'Cosine'
    }
)

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

retriever.index_data(data)


info = retriever.get_collection_info()
print(f"   Total points: {info.get('total_points', 0)}")
print(f"   Content types: {info.get('content_types', {})}")

