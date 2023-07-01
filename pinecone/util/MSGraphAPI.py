# util functions for interacting with Microsoft Graph API
import os
import requests
from dotenv import load_dotenv
load_dotenv()


def getActiveDirectoryToken(client_id:str, client_secret:str, tenant_id:str) -> str:
  """
  Function to get the Active Directory Token.

  Args:
    client_id (str): The Application (client) ID that the Azure portal - App registrations experience assigned to your app.
    client_secret (str): A secret string that the application uses to prove its identity when requesting a token.
    tenant_id (str): The directory (tenant) ID. Represents the Azure Active Directory instance.

  Returns:
    str: The Active Directory Token, or None if an error occurred.
  """
  # Endpoint for getting the token
  url = f"https://login.microsoftonline.com/{tenant_id}/oauth2/v2.0/token"

  # Payload includes grant type, client ID, client secret, and scope
  payload = {
    'grant_type': 'client_credentials',
    'client_id': client_id,
    'client_secret': client_secret,
    'scope': 'https://graph.microsoft.com/.default'
  }

  # Send a POST request to the endpoint with the payload
  response = requests.post(url, data=payload)
  try:
    # Raise an exception if the request was unsuccessful
    response.raise_for_status()

    # Return the access token from the response
    json_response = response.json()
    return json_response['access_token']
  
  except Exception as e:
    # return None if an error occurred
    print(f"Error getting token: {e}")
    return None

def getUsers(token:str) -> list:
  """
  Function to get a list of all user IDs and emails in the organization.

  Args:
    token (str): The Active Directory Token.

  Returns:
    list: A list of dictionaries where each dictionary contains the id and email of each user.
  """

  # Define the headers for the request
  headers = {"Authorization": f"Bearer {token}"}

  try:
    # Endpoint to get all users
    users_endpoint = "https://graph.microsoft.com/v1.0/users"

    # Send a request to the endpoint
    users_response = requests.get(users_endpoint, headers=headers)
    users_response.raise_for_status()

    # Extract the users from the response
    users = users_response.json()['value']

    # Return a list of dictionaries where each dictionary contains the id and email of each user
    return [{'id': user['id'], 'email': user['mail']} for user in users]

  except Exception as e:
    print(f"Error getting users: {e}")
    return None

def getSites(token: str) -> list:
  """
  Function to get all sites in the organization.

  Args:
    token (str): The Active Directory Token.

  Returns:
    list: A list of sites.
  """
  
  sites_endpoint = "https://graph.microsoft.com/v1.0/sites?search=*"

  headers = {"Authorization": f"Bearer {token}"}

  try:
    response = requests.get(sites_endpoint, headers=headers)
    response.raise_for_status()
    
    return response.json()['value']

  except Exception as e:
    print(f"Error getting sites: {e}")
    return None

def getSiteDrives(token: str) -> list:
  """
  Function to get all drive IDs in the organization along with their types.

  Args:
    token (str): The Active Directory Token.

  Returns:
    list: A list of dictionaries where each dictionary contains the id and type of each drive.
  """

  # Define the headers for the request
  headers = {"Authorization": f"Bearer {token}"}

  try:
    # Get the list of all sites
    sites = getSites(token)

    # Create a list to store the drive info
    drives_info = []

    # For each site, get the associated drives
    for site in sites:
      site_id = site['id']
      drives_endpoint = f"https://graph.microsoft.com/v1.0/sites/{site_id}/drives"

      response = requests.get(drives_endpoint, headers=headers)
      response.raise_for_status()

      # Extract the 'id' and 'driveType' of each drive and append to the list
      for drive in response.json()['value']:
        drives_info.append({
          'id': drive['id'], 
          'type': drive['driveType']
        })

    # Return the list of drive info
    return drives_info

  except Exception as e:
    print(f"Error getting drive IDs: {e}")
    return None

def getUserDrives(token: str, user_id: str) -> dict:
  """
  Function to get the user's personal drive ID.

  Args:
    token (str): The Active Directory Token.
    user_id (str): The User ID.

  Returns:
    dict: A dictionary with the id and type of the user's drive.
  """

  # Define the headers for the request
  headers = {"Authorization": f"Bearer {token}"}

  try:
    # Endpoint to get the user's personal drive
    drive_endpoint = f"https://graph.microsoft.com/v1.0/users/{user_id}/drive"

    # Send a request to the endpoint
    drive_response = requests.get(drive_endpoint, headers=headers)
    drive_response.raise_for_status()

    # Extract the 'id' and 'driveType' from the response
    drive = drive_response.json()

    return {
      'id': drive['id'], 
      'type': drive['driveType']
    }

  except Exception as e:
    print(f"Error getting user's drive ID: {e}")
    return None

def listUserFileMetadata(token: str, user_id: str) -> list:
  """
  Function to list all the files in the user's personal drive.

  Args:
    token (str): The Active Directory Token.
    user_id (str): The User ID.

  Returns:
    list: A list of dictionaries where each dictionary contains the itemId, driveId, location, and name of each file.
  """

  # Define the headers for the request
  headers = {"Authorization": f"Bearer {token}"}

  try:
    # Get the user's drive ID
    drive = getUserDrives(token, user_id)
    drive_id = drive['id']
    drive_type = drive['type']

    # Endpoint to get the files in the root of the user's personal drive
    files_endpoint = f"https://graph.microsoft.com/v1.0/drives/{drive_id}/root/children"

    # Send a request to the endpoint
    files_response = requests.get(files_endpoint, headers=headers)
    files_response.raise_for_status()

    # Extract the files from the response
    files = files_response.json()['value']

    # Return a list of dictionaries where each dictionary contains the itemId, driveId, location, and name of each file
    return [{
      'name': file['name'],
      'item_id': file['id'],
      'drive_id': drive_id,
      'location': 'sharepoint' if drive_type == 'documentLibrary' else 'onedrive',
      'user': user_id
      } for file in files]

  except Exception as e:
    print(f"Error listing user's files: {e}")
    return None

def listSiteFileMetadata(token:str) ->  list:
  """
  Function to list all files from every drive in the organization.

  Args:
    token (str): The Active Directory Token.

  Returns:
    list: A list of dictionaries, where each dictionary contains the driveId, itemId, 
    and location ('onedrive' or 'sharepoint') for a file.
  """

  try:
    # Get all drive IDs along with their types
    drives = getSiteDrives(token)

    # Define the headers for the request
    headers = {"Authorization": f"Bearer {token}"}

    # Create a list to store the dictionaries for each file
    all_files_info = []

    # For each drive, get the list of files and add their info to the list
    for drive in drives:
      drive_id = drive['id']
      drive_type = drive['type']

      files_endpoint = f"https://graph.microsoft.com/v1.0/drives/{drive_id}/root/children"
      response = requests.get(files_endpoint, headers=headers)
      response.raise_for_status()
      files = response.json()['value']

      for file in files:
        file_info = {
          'name': file['name'],
          'item_id': file['id'],
          'drive_id': drive_id,
          'location': 'sharepoint' if drive_type == 'documentLibrary' else 'onedrive'
        }
        all_files_info.append(file_info)

    # Return the list of all files info
    return all_files_info

  except Exception as e:
    print(f"Error listing files: {e}")
    return None
  
def downloadFileContent(token: str, drive_id: str, item_id: str) -> str:
  """
  Function to download the content of a file as a string.

  Args:
    token (str): The Active Directory Token.
    drive_id (str): The Drive ID.
    item_id (str): The Item ID.

  Returns:
    str: The content of the file.
  """
  # Define the headers for the request
  headers = {"Authorization": f"Bearer {token}"}

  try:
    # Endpoint to get the file content
    retrieval_endpoint = f"{os.getenv('server_url')}/api/sharepoint/getDocumentContent"
    payload = {
      'authToken': token,
      'driveId': drive_id,
      'documentId': item_id,
    }
    response = requests.post(retrieval_endpoint, json=payload)
    text = response.text

    # Return the content of the file
    return text

  except Exception as e:
    print(f"Error downloading file content: {e}")
    return None