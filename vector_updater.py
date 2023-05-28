from rate_limiter import Api

class VectorUpdater:
  """
  Handles updating the vector database given a queue of documents to update
  """
  def __init__(self, queue_location, vdb):
    """
    Initializes the VectorLoaderObject
    :param queue_location (str): endpoint of queue of documents
    :param vdb (obj): instance of vector database
    """
    self.queue = []
    self.queue_location = queue_location
    self.vdb = vdb
    self.pinecone_request = Api(average_rate_limit=rpm_limit_pinecone, max_retries=3)
    # TODO

  def update_local_queue(self):
    """
    Updates the private variable queue by querying from the queue_location
    """

    # query for updated list
    new_documents = self.queue # TODO
    
    # consider various prioritization strategies to prevent starvation
    # TODO
    
    # concatenate current and new queue
    self.queue = new_documents

  def construct_vector_object(self, vector_id:str, vector_value, doc_id:str, file_location:str, chunk_index:int):
    """
    Returns tuple of a vector's id, value (numberical representation), and metadata given attributes in the shape required by the vdb
    """
    metadata = {
      'document_id':doc_id,
      'file_location': file_location,
      'chunk_index': chunk_index
    }

    return (vector_id, vector_value, metadata)
  
  def update_metadata_file_location(self, document_id:str, updated_location:str):
    """
    update file_location (metadata) of all vectors corresponding to some document id
    """
    # query all vectors from vdb filtering by document_id
    results = self.vdb.query(metadata={'document_id':document_id})
    matches = results['matches']
    # TODO

    # update file location of each match
    for match in matches:
      match['metadata']['file_location'] = updated_location

    # upsert updated data
    self.vdb.upsert

  def update_vector_object(self):
    pass

  def update_vectors_in_queue(self):
    pass

