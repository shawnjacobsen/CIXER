import pinecone
import numpy as np

def getAllVectors(index_name:str, totalVectors:int):
  # Get the description of the index
  index_description = pinecone.describe_index(index_name)

  # Get the dimensionality of the index
  dimension = int(index_description.dimension)

  # Create a random vector of the appropriate size
  random_vector = np.random.rand(dimension)

  # Initialize the index
  vdb = pinecone.Index(index_name)

  if (totalVectors < 1000):
    # Query the index for similar vectors
    query_result = vdb.query(
      vector=random_vector.tolist(),
      top_k=totalVectors,
      include_metadata=True,
      include_values=True
    )
    return query_result
  else:
    raise Exception("vector count too long (> 1000)")