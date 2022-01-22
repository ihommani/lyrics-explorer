import re

# Imports the Google Cloud client library
from google.cloud import storage

from bs4 import BeautifulSoup
from bs4.element import SoupStrainer

# Instantiates a client
storage_client = storage.Client()

# The name for the new bucket
bucket_name = "ihommani-html-bucket"
bucket = storage_client.get_bucket(bucket_name)

blob = bucket.blob("rap/diams/2006-06-02/dans_ma_bulle/la_boullette.html")


with open("/tmp/lyrics.html", 'wb') as file_obj:
    blob.download_to_file(file_obj)

with open("/tmp/lyrics.html", 'r') as file_obj:
    soup = BeautifulSoup(file_obj, 'html.parser')

def is_lyrics_container(tag):
    return  tag.name == 'div' and tag.get('data-lyrics-container') == "true"

lyrics_cleaning_expression = '\\[.*?\\]|\\n'

lyrics_elements =  [re.sub(lyrics_cleaning_expression, '', i.get_text(' ').strip()) for i in soup.find_all(is_lyrics_container)]

print(lyrics_elements)

