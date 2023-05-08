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

import requests

# Set up SharePoint API credentials and endpoint
sharepoint_api_url = "https://your.sharepoint.com/_api/"
sharepoint_username = "YOUR_SHAREPOINT_USERNAME"
sharepoint_password = "YOUR_SHAREPOINT_PASSWORD"
sharepoint_auth = requests.auth.HTTPBasicAuth(sharepoint_username, sharepoint_password)

# Set up API headers
api_headers = {
    "Accept": "application/json;odata=verbose",
    "Content-Type": "application/json;odata=verbose",
}

# Construct URL for SharePoint API call to get all items in the document library
api_url = sharepoint_api_url + "web/lists/getbytitle('DOCUMENT_LIBRARY_NAME')/items"

# Make SharePoint API call to get all items in the document library
response = requests.get(api_url, auth=sharepoint_auth, headers=api_headers)

# Extract list of document IDs that User XYZ has access to from the API response
document_ids = []
for item in response.json()["d"]["results"]:
    if item.get("RoleAssignments", {}).get("results", []):
        for role_assignment in item["RoleAssignments"]["results"]:
            if role_assignment.get("Member", {}).get("LoginName", "") == "USER_XYZ":
                document_ids.append(item["Id"])