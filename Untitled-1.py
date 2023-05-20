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