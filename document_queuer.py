### LOADER
# Responsible for tracking drive changes and queueing changed documents

# requires onedrive permissions

### Tracker
# Implements Notification Tracker for OneDrive
#   - refreshing of notification tracker
#   - intercepting notifications
# Regular Interval Check (for fault tolerance)
# will trigger update of vectors whose corresponding cloud documents changed


# Tracker hook
class Tracker:
  def __init__(self, drive_location:str):
    # setup listener
    # TODO

    # recieves links to documents
    # marked as metadata or content change
    # get metadata and/or content of changed document
    #   - change metadata of all vectors whose metadata includes document_id
    #   - change vectors of all vectors whose metadata includes document_id
    # TODO
    
    pass

  def add_file_to_queue(file_loc:str):
    # submit put request to queue/database
    # TODO

    pass