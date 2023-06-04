import os
import re
from uuid import uuid4
from time import time,sleep

import openai
import pinecone

from helpers import open_file, save_file
from sharepoint_documents import get_access_token, get_sharepoint_document, user_has_access_to_file

def gpt3_embedding(content, engine='text-embedding-ada-002'):
    """
    Get numerical representation of content based on the specified engine model from GPT3
    :param content (str): content to be vectorized
    :param engine (str): OpenAI embedding model to use
    :return vector (list(float))
    """
    content = content.encode(encoding='ASCII',errors='ignore').decode()  # fix any UNICODE errors
    response = openai.Embedding.create(input=content,engine=engine)
    vector = response['data'][0]['embedding']  # this is a normal list
    return vector

def retrieve_accessible_similar_information(vdb, sharepoint_auth_token, user_email:str, vector, k=6, threshold=2, max_tries=3, info_separator=" -- "):
    """
    Return Sharepoint documents similar to some vector which are accessible to the specified user 
    :param vdb (Pinecone DB): Pinecone Object used to query pinecone for vectors
    :param sharepoint_auth_token (str): returned auth token from login.microsoftonline.com
    :param user_email (str): sharepoint user email to check if user has access to some given Sharepoint document
    :param vector: the vector to search for similar vectors of in the vector database
    :param k (int, optional): number of semantically similar documents to poll for at a time. Defaults to 6.
    :param threshold (int, optional): min number of documents to return. Defaults to 2.
    :param max_tries (int, optional): number of repolls to reach threshold. Defaults to 3.

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
        # query response { 'matches': [{'id','score','values', 'metadata':{ 'document_id', 'file_location', 'chunk_index' }}] }
        res = vdb.query(vector=vector, top_k=num_vectors_to_retrieve, include_metadata=True, exclude=previously_queried_vectors)
        matches = res['matches']
        ids = [match['id'] for match in matches]
        previously_queried_vectors += ids

        # Filter out elements in matches whose 'id' is in previously_queried_vectors
        matches = [match for match in matches if match['id'] not in previously_queried_vectors]
        
        # append document content if the user has access
        for match in matches:
            if user_has_access_to_file(sharepoint_auth_token, user_email, match['metadata']['file_location']):
                doc_contents = get_sharepoint_document(
                    sharepoint_auth_token,
                    match['metadata']['file_location'],
                    match['metadata']['chunk_index']
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

def generate_qa_log( user_email:str, prompter_message:str, responder_message:str, prompter_metadata, responder_metadata):
    """
    generates a properly formated dictionary to log single Q/A exchanges
    
    :param user_email (str): the user's email
    :param prompter_message (str): prompter message content
    :param responder_message (str): the responder's response
    :param prompter_metadata: the prompter's metadata
    :param responder_metadata: the bot's metadata
    :return dict(
        id:str,
        message:  dict(prompter:str,responder:str),
        metadata: dict(prompter:dict(),responder:dict())
        )
    """
    log_id = str(uuid4())
    qa_log = {
        'id': log_id,
        'user_email': user_email,
        'message': {
            'prompter': prompter_message,
            'responder': responder_message,
        },
        'metadata': {
            'prompter': prompter_metadata,
            'responder': responder_metadata,
        }
    }

    return qa_log

def construct_prompt(previous_prompter_msg:str, previous_responder_msg:str, curr_prompter_msg:str, context_info:str, prompt_template:str='prompt.txt'):
    """
    constrcits a prompt with conversational context and information to be fed to the LLM

    :param previous_prompter_msg (str): message from previous Q/A exchange for context
    :param previous_responder_msg (str): message from previous Q/A exchange for context
    :param curr_prompter_msg (str): current prompter's message to be responded to
    :param context_info (str): any additional info to be provided to the model
    :param prompt_template (str): text file location of prompt template
    :return prompt (str): constructed prompt
    """
    # import prompt template
    prompt = open_file(prompt_template)

    prompt = prompt.replace("<<USER CONTEXT>>", previous_prompter_msg)
    prompt = prompt.replace("<<BOT CONTEXT>>", previous_responder_msg)
    prompt = prompt.replace('<<MESSAGE>>', curr_prompter_msg)
    prompt = prompt.replace('<<INFO>>',context_info)
    return prompt
