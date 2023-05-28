import os
import io
import re
import json
import requests
import datetime
from uuid import uuid4
from time import time,sleep

# document chunk management
import pdfplumber
from shareplum import Site
from shareplum import Office365
from langchain.text_splitter import CharacterTextSplitter

import openai
import pinecone
from dotenv import load_dotenv

# load environment variables
load_dotenv()
bot_name = os.getenv("bot_name")
key_openai = os.getenv("key_openai")
key_pinecone = os.getenv("key_pinecone")
env_pinecone = os.getenv("env_pinecone")
idx_pinecone = os.getenv("idx_pinecone")
client_secret_AD = os.getenv("client_secret_AD")
app_id_AD = os.getenv("app_id_AD")
directory_id_AD = os.getenv("directory_id_AD")
tenant_id_AD = os.getenv("tenant_id_AD")

def timestamp_to_datetime(unix_time):
    return datetime.datetime.fromtimestamp(unix_time).strftime("%A, %B %d, %Y at %I:%M%p %Z")

def open_file(filepath):
    with open(filepath, 'r', encoding='utf-8') as infile:
        return infile.read()


def save_file(filepath, content):
    with open(filepath, 'w', encoding='utf-8') as outfile:
        outfile.write(content)


def load_json(filepath):
    with open(filepath, 'r', encoding='utf-8') as infile:
        return json.load(infile)


def save_json(filepath, payload):
    with open(filepath, 'w', encoding='utf-8') as outfile:
        json.dump(payload, outfile, ensure_ascii=False, sort_keys=True, indent=2)


def gpt3_embedding(content, engine='text-embedding-ada-002'):
    content = content.encode(encoding='ASCII',errors='ignore').decode()  # fix any UNICODE errors
    response = openai.Embedding.create(input=content,engine=engine)
    vector = response['data'][0]['embedding']  # this is a normal list
    return vector

def get_access_token(client_id, client_secret, tenant_id):
    token_url = f'https://login.microsoftonline.com/{tenant_id}/oauth2/v2.0/token'
    token_payload = {
        'grant_type': 'client_credentials',
        'client_id': client_id,
        'client_secret': client_secret,
        'scope': 'https://graph.microsoft.com/.default'
    }
    response = requests.post(token_url, data=token_payload)
    access_token = response.json().get('access_token')
    return access_token

def get_sharepoint_document(auth_token, sharepoint_file_url, document_index):
    
    # get PDF file from sharepoint
    headers = {'Authorization': f'Bearer {auth_token}'}
    response = requests.get(sharepoint_file_url, headers=headers)
    pdf_content = response.content

    # Read the PDF and extract text
    pdf_stream = io.BytesIO(pdf_content)
    
    full_file_text = ""
    with pdfplumber.open(pdf_stream) as pdf:
        for page in pdf.pages:
            full_file_text += page.extract_text()

    # get corresponding document chunk by its index
    text_splitter = CharacterTextSplitter(separator = "\n", chunk_size = 1000, chunk_overlap  = 200, length_function = len)
    chunks = text_splitter.split_text(full_file_text)
    if (document_index > len(chunks) - 1):
        document_index = len(chunks) - 1
    document = chunks[document_index]
    return document

def user_has_access_to_file(auth_token, user_email, sharepoint_file_location):
    headers = {'Authorization': f'Bearer {auth_token}'}
    file_url = f'https://graph.microsoft.com/v1.0/sites/root/drive/root:/{sharepoint_file_location}:/permissions'
    response = requests.get(file_url, headers=headers)
    permissions = response.json().get('value', [])

    for permission in permissions:
        if permission.get('grantedTo', {}).get('user', {}).get('email') == user_email and permission.get('roles'):
            return True
    return False

def retrieve_accessible_similar_information(vdb, sharepoint_auth_token, user_email:str, vector, k=6, threshold=2, max_tries=3, info_separator=" -- "):
    """_summary_

    Args:
        vdb (Pinecone DB): Pinecone Object used to query pinecone for vectors
        sharepoint_auth_token (str): returned auth token from login.microsoftonline.com
        user_email (str): sharepoint user email to check if user has access to some given Sharepoint document
        vector: the vector to search for similar vectors of in the vector database
        k (int, optional): number of semantically similar documents to poll for at a time. Defaults to 6.
        threshold (int, optional): min number of documents to return. Defaults to 2.
        max_tries (int, optional): number of repolls to reach threshold. Defaults to 3.

    Returns:
        accessible_documents (str): concatentated list of similar documents content
    """

    # list(str) of similar documents that the user has access to
    previously_queried_vectors = []
    accessible_documents = ""
    tries = 0

    # continue to query until meeting threshold or maximum tries are met
    while (len(accessible_documents) < threshold and tries < max_tries):
        # for current try, retrieve k + number of previously queried vectors to get new vectors
        num_vectors_to_retrieve = k + len(previously_queried_vectors)
        # query response { 'matches': [{'id','score','values', 'metadata':{ 'sharepoint_file_loc', 'document_index' }}] }
        res = vdb.query(vector=vector, top_k=k, include_metadata=True, exclude=previously_queried_vectors)
        matches = res['matches']
        ids = [match['id'] for match in matches]
        previously_queried_vectors += ids

        # Filter out elements in matches whose 'id' is in previously_queried_vectors
        matches = [match for match in matches if match['id'] not in previously_queried_vectors]
        
        # append document content if the user has access
        for match in matches:
            if user_has_access_to_file(sharepoint_auth_token, user_email, match['metadata']['sharepoint_file_loc']):
                doc_contents = get_sharepoint_document(
                    sharepoint_auth_token,
                    match['metadata']['sharepoint_file_loc'],
                    match['metadata']['document_index']
                    )
                accessible_documents += doc_contents + info_separator
        
        # increment number of tries
        tries += 1

    return accessible_documents

def gpt3_completion(prompt, engine='text-davinci-003', temp=0.0, top_p=1.0, tokens=400, freq_pen=0.0, pres_pen=0.0, stop=['USER:', 'ASSISTANT:']):
    max_retry = 5
    retry = 0
    prompt = prompt.encode(encoding='ASCII',errors='ignore').decode()
    while True:
        try:
            response = openai.Completion.create(
                engine=engine,
                prompt=prompt,
                temperature=temp,
                max_tokens=tokens,
                top_p=top_p,
                frequency_penalty=freq_pen,
                presence_penalty=pres_pen,
                stop=stop
            )
            text = response['choices'][0]['text'].strip()
            text = re.sub('[\r\n]+', '\n', text)
            text = re.sub('[\t ]+', ' ', text)
            filename = '%s_gpt3.txt' % time()
            if not os.path.exists('gpt3_logs'):
                os.makedirs('gpt3_logs')
            save_file('gpt3_logs/%s' % filename, prompt + '\n\n==========\n\n' + text)
            return text
        except Exception as error:
            retry += 1
            if retry >= max_retry:
                return "GPT3 error: %s" % error
            print('Error communicating with OpenAI:', error)
            sleep(1)

def load_conversation(results):
    result = list()
    for m in results['matches']:
        info = load_json(f"conversations/{m['id']}.json")
        result.append(info)
    ordered = sorted(result, key=lambda d: d['time'], reverse=False)  # sort them all chronologically
    messages = [i['message'] for i in ordered]
    return '\n'.join(messages).strip()

if __name__ == '__main__':
    openai.api_key = key_openai
    pinecone.init(api_key=key_pinecone, environment=env_pinecone)
    vdb = pinecone.Index(idx_pinecone)
    auth_token = get_access_token(app_id_AD,client_secret_AD,tenant_id_AD)
    user_email = input('Enter Sharepoint Email: ')
    while True:
        ##### USER PROMPT #####

        # get user input message and create vector representation for similarity search
        message = input('\n\nUSER: ')
        vector_message = gpt3_embedding(message)


        # generate user metadata for logging
        timestamp = time()
        timestring = timestamp_to_datetime(timestamp)
        metadata_user = {'email': user_email, 'speaker': 'USER', 'timestring': timestring}


        ##### BOT RESPONSE #####

        # get previous q/a for context
        conversation = ""

        # search for relevant documents, and generate a response
        similar_information = retrieve_accessible_similar_information(vdb,auth_token,user_email,vector_message)
        
        # construct prompt
        prompt = open_file('prompt.txt')
        prompt = prompt.replace('<<CONVERSATION>>', conversation).replace('<<MESSAGE>>', message).replace('<<INFO>>',similar_information)
        
        # generate & print response
        response = gpt3_completion(prompt)
        print(f"\n\{bot_name}: {response}")

        # generate bot metadata for logging
        timestamp_bot = time()
        timestring_bot = timestamp_to_datetime(timestamp)
        metadata_bot = {'speaker': 'BOT', 'message': response, 'timestring': timestring_bot}


        ##### LOG Q/A WITH METADATA #####
        log_id = str(uuid4())
        qa_log = {
            'id':log_id,
            'user_message': message,
            'bot_response': response,
            'user_data': metadata_user,
            'bot_data': metadata_bot,
        }
        save_json(f"conversations/{log_id}.json", qa_log)