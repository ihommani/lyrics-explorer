import functions_framework
import re

# Imports the Google Cloud client library
from google.cloud import storage

from bs4 import BeautifulSoup

# Instantiates a client
storage_client = storage.Client()
lyrics_cleaning_expression = '\\[.*?\\]|\\n'


# Model of the event: https://cloud.google.com/functions/docs/calling/storage#functions-calling-storage-python
@functions_framework.cloud_event
def hello_cloud_event(cloud_event):
    print(f"Received event with ID: {cloud_event['bucket']} and data {cloud_event.data}")

    bucket = storage_client.get_bucket(cloud_event['bucket']) # Get the bucket name from the env variable 
    blob = bucket.blob(cloud_event['file'])

    with open("/tmp/lyrics.html", 'wb') as file_obj:
        blob.download_to_file(file_obj)

    with open("/tmp/lyrics.html", 'r') as file_obj:
        soup = BeautifulSoup(file_obj, 'html.parser')
        lyrics_elements =  [re.sub(lyrics_cleaning_expression, '', i.get_text(' ').strip()) for i in soup.find_all(is_lyrics_container)]
        bucket = storage_client.bucket('test-ihommani')
        blob = bucket.blob(cloud_event['file'].replace('.html', '.txt'))
        blob.upload_from_string(lyrics_elements[0])

    print(lyrics_elements)
    return "OK"


def is_lyrics_container(tag):
    return  tag.name == 'div' and tag.get('data-lyrics-container') == "true"