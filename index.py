import os
import time
import webbrowser
from flask import Flask, request, redirect
import threading
import requests
import urllib

from document_helpers import get_onedrive_file_names

from dotenv import load_dotenv
# load environment variables
load_dotenv()
client_secret_AD = os.getenv("client_secret_AD")
secret_id_AD = os.getenv('secret_id_AD')
app_id_AD = os.getenv("app_id_AD")
tenant_id_AD = os.getenv("tenant_id_AD")

app = Flask(__name__)
app.secret_key = os.getenv('flask_secret')
access_token = None

@app.route('/')
def home():
  # Redirect the user to the Microsoft OAuth2.0 endpoint
  params = {
    'client_id': app_id_AD,
    'response_type': 'code',
    'redirect_uri': 'http://localhost:5000/callback',
    'scope': 'Files.Read.All offline_access'  # The permissions your app needs
  }
  url = f'https://login.microsoftonline.com/{tenant_id_AD}/oauth2/v2.0/authorize?' + urllib.parse.urlencode(params)
  return redirect(url)

@app.route('/callback')
def callback():
  # The user is redirected here by Microsoft with an authorization code
  code = request.args.get('code')
  
  # Exchange the authorization code for an access token
  data = {
    'client_id': app_id_AD,
    'client_secret': client_secret_AD,
    'code': code,
    'grant_type': 'authorization_code',
    'redirect_uri': 'http://localhost:5000/callback',
    'scope': 'Files.Read.All offline_access'  # The permissions your app needs
  }
  response = requests.post(f'https://login.microsoftonline.com/{tenant_id_AD}/oauth2/v2.0/token', data=data)

  response_json = response.json()

  # Check the response for error information
  if 'error' in response_json:
    error = response_json['error']
    error_description = response_json.get('error_description', '')

    if 'expired' in error_description:
      # If the token has expired, redirect to the home page
      return redirect('/')
    else:
      # If the token is invalid for some other reason, return an error message
      return f"Invalid token: {error}. {error_description}"

  elif response.status_code == 200:
    # We now have an access token!
    global access_token
    access_token = response_json['access_token']

    # Return a response to the user
    return "Login successful! You can now close this page."

  else:
      return f"Error: {response.text}"


# Run the app in a separate thread
def run_app():
  app.run()

threading.Thread(target=run_app).start()

# Open a web browser to the home page of our app
webbrowser.open('http://localhost:5000')

# Wait for user to authenticate
while access_token is None:
  time.sleep(1)

# start Q/A session after athenticating
print(f"Welcome to ChairGPT (Access Token: {access_token[:5]})")
print("Your files:")
print(get_onedrive_file_names())