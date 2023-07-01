# Deletes Vectors which reference the same Sharepoint document and chunk index

import os
import pinecone
from dotenv import load_dotenv
from util.Pinecone import getAllVectors
load_dotenv()

vdb_index_name = os.getenv("pinecone_idx")
pinecone.init(
  api_key=os.getenv("pinecone_key"),
  environment=os.getenv("pinecone_env")
)
index = pinecone.Index(vdb_index_name)
# get all vectors
all_vectors = getAllVectors(vdb_index_name, 676)
matches = all_vectors['matches']

print(f"num vectors: {len(matches)}\n")

vector_ids = [v['id'] for v in matches]

# Create a dictionary to keep track of value counts
duplicate_ids = []

# track sets of duplicates by document_id and chunk_index they reference
value_counts = {}

# Iterate over the matches, find duplicates
for match in matches:
  document_id = match['metadata']['document_id']
  chunk_index = match['metadata']['chunk_index']
  tuple_key = (document_id, chunk_index)

  if tuple_key in value_counts:
    value_counts[tuple_key] += 1
    duplicate_ids.append(match['id'])
  else:
    value_counts[tuple_key] = 1

for tuple_key, count in value_counts.items():
  if count > 1:
    print(f"{count} occurrences: {tuple_key}")

print(f"\n\n found {len(duplicate_ids)} duplicated sets")

# delete duplicates
print("Deleting duplicates by their id...")
delete_response = index.delete(ids=duplicate_ids)
print(delete_response)