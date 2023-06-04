import os
import time
import webbrowser
import threading
import requests
import urllib
from flask import Flask, request, redirect
import openai
import pinecone

from sharepoint_documents import get_onedrive_file_names, get_user_email_by_token
from helpers import get_datetime, save_json
from qa import gpt3_embedding, gpt3_completion, construct_prompt, retrieve_accessible_similar_information, generate_qa_log

##### load environment variables #####
from dotenv import load_dotenv
load_dotenv()
# Microsoft Graph API
client_secret_AD = os.getenv("client_secret_AD")
secret_id_AD = os.getenv('secret_id_AD')
app_id_AD = os.getenv("app_id_AD")
tenant_id_AD = os.getenv("tenant_id_AD")
directory_id_AD = os.getenv("directory_id_AD")
# Flask
flask_secret = os.getenv('flask_secret')
# OpenAI & Pinecone
key_openai = os.getenv("key_openai")
key_pinecone = os.getenv("key_pinecone")
env_pinecone = os.getenv("env_pinecone")
idx_pinecone = os.getenv("idx_pinecone")

app = Flask(__name__)
app.secret_key = flask_secret
openai.api_key = key_openai
pinecone.init(api_key=key_pinecone, environment=env_pinecone)
vdb = pinecone.Index(idx_pinecone)
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

# setup environment
user_email = get_user_email_by_token(access_token)
qa_log = {'message':{'prompter':"",'responder':""}}

# start Q/A session after athenticating
print("Your files:")
print(get_onedrive_file_names(access_token), '\n')
print(f"Welcome to ChairGPT (Please enter '/exit' to quit)")
print(f"(Access Token: {access_token[:5]})\n")

while True:
  ##### USER PROMPT #####
  # get user input message and create vector representation for similarity search
  question = input("USER: ")
  vector_message = gpt3_embedding(question)

  # generate user metadata for logging
  metadata_user = {'email': user_email, 'speaker': 'USER', 'timestring': get_datetime()}


  ##### BOT RESPONSE #####
  # search for relevant documents, and generate a response
  similar_information:str = retrieve_accessible_similar_information(vdb, access_token, user_email, vector_message)
  
  # generate & print response
  prompt = construct_prompt(
    qa_log['message']['prompter'],
    qa_log['message']['responder'],
    question,
    similar_information
  )
  response = gpt3_completion(prompt)
  print(f"\n\nchairGPT: {response}")

  # generate bot metadata for logging
  metadata_bot = {'speaker': 'BOT', 'timestring': get_datetime()}


  ##### LOG Q/A WITH METADATA #####
  qa_log = generate_qa_log(user_email, question, response, metadata_user, metadata_bot)
  save_json(f"conversations/{qa_log['id']}.json", qa_log)