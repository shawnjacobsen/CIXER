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
key_openai = os.getenv("key_openai")
key_pinecone = os.getenv("key_pinecone")
env_pinecone = os.getenv("env_pinecone")
idx_pinecone = os.getenv("idx_pinecone")

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

def get_sharepoint_document(sharepoint_file_url, sharepoint_authcookie, document_index):
    
    # get PDF file from sharepoint
    response = requests.get(sharepoint_file_url, cookie=sharepoint_authcookie)
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
    if (document_index < len(chunks) - 1):
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

def retrieve_accessible_documents(vdb, userId:str, k=6, threshold=2, max_tries=3):
    """_summary_

    Args:
        vdb (Pinecone DB): Pinecone Object used to query pinecone for vectors
        userId (str): sharepoint user id to check if user has access to some given Sharepoint document
        k (int, optional): number of semantically similar documents to poll for at a time. Defaults to 6.
        threshold (int, optional): min number of documents to return. Defaults to 2.
        max_tries (int, optional): number of repolls to reach threshold. Defaults to 3.

    Returns:
        list(str): list of similar documents
    """

    # query response { 'matches': [{'id','score','values', 'metadata':{ 'sharepoint_file_id', 'document_index' }}] }
    res = vdb.query(vector=vector, top_k=k, include_metadata=True)
    matches = res['matches']
    
    # list(str) of similar documents that the user has access to
    accessible_documents = []
    # WIP
    for match in matches:
        doc_contents = ""
        if user_has_access_to_file():
            accessible_documents.append(doc_contents)
    
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
    print("test")
    convo_length = 30
    openai.api_key = key_openai
    pinecone.init(api_key=key_pinecone, environment=env_pinecone)
    vdb = pinecone.Index(idx_pinecone)
    while True:

        # payload containing vectors to be sent to Pinecone
        payload = list()

        ##### USER PROMPT #####

        # vectorize user input and append to payload
        uuid_user = str(uuid4())
        message = input('\n\nUSER: ')
        vector = gpt3_embedding(message)
        payload.append((uuid_user, vector))

        # generate metadata for logging
        timestamp = time()
        timestring = timestamp_to_datetime(timestamp)
        metadata_user = {'speaker': 'USER', 'time': timestamp, 'message': message, 'timestring': timestring, 'uuid': uuid_user}

        # save user metadata
        save_json(f"conversations/{uuid_user}.json", metadata_user)
    
        ##### BOT RESPONSE #####

        # search for relevant messages, and generate a response
        results = vdb.query(vector=vector, top_k=convo_length)
        conversation = load_conversation(results)  # results should be a DICT with 'matches' which is a LIST of DICTS, with 'id'
        prompt = open_file('prompt.txt').replace('<<CONVERSATION>>', conversation).replace('<<MESSAGE>>', message)
        
        # generate response, vectorize, save to pinecone, print response
        uuid_bot = str(uuid4())
        response = gpt3_completion(prompt)
        vector = gpt3_embedding(response)
        payload.append((uuid_bot, vector))
        print(f"\n\nCIXER: {response}")

        # generate metadata for logging
        timestamp = time()
        timestring = timestamp_to_datetime(timestamp)
        metadata_bot = {'speaker': 'CIXER', 'time': timestamp, 'message': response, 'timestring': timestring, 'uuid': uuid_bot}

        # save bot metadata
        save_json(f"conversations/{uuid_bot}.json", metadata_bot)

        ##### save payload to pincecone #####
        vdb.upsert(payload)