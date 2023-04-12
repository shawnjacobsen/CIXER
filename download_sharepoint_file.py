import os
import requests
from ms_graph import generate_access_token, GRAPH_API_ENDPOINT

APP_ID = '<App ID>'
SCOPES = ['Files.Read']
save_location = os.getcwd()

file_ids = ['Folder Id1', 'Folder Id2']

access_token = generate_access_token(APP_ID, scopes=SCOPES)
headers = {
	'Authorization': 'Bearer ' + access_token['access_token']
}

# Step 1. get the file name
for file_id in file_ids:
	response_file_info = requests.get(
		GRAPH_API_ENDPOINT + f'/me/drive/items/{file_id}',
		headers=headers,
		params={'select': 'name'}
	)
	file_name = response_file_info.json().get('name')

	# Step 2. downloading OneDrive file
	response_file_content = requests.get(GRAPH_API_ENDPOINT + f'/me/drive/items/{file_id}/content', headers=headers)
	with open(os.path.join(save_location, file_name), 'wb') as _f:
		_f.write(response_file_content.content)