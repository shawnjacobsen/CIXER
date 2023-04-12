### LOADER
# Responsible for tracking drive changes and relaying changes to vector database

# requires onedrive permissions

### Tracker
# Implements Notification Tracker for OneDrive
#   - refreshing of notification tracker
#   - intercepting notifications
# Regular Interval Check (for fault tolerance)
# will trigger update of vectors whose corresponding documents changed


### Vector Updater
# recieves links to documents
# marked as metadata or content change
# get metadata and/or content of changed document
#   - change metadata of all vectors whose metadata includes document_id
#   - change vectors of all vectors whose metadata includes document_id