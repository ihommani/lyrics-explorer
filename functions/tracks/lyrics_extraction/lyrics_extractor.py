import re

from bs4 import BeautifulSoup
from bs4.element import SoupStrainer

with open("katyperry.html") as fp:
    soup = BeautifulSoup(fp, 'html.parser')


def is_lyrics_container(tag):
    return  tag.name == 'div' and tag.get('data-lyrics-container') == "true"

lyrics_cleaning_expression = '\\[.*?\\]|\\n'

lyrics_elements =  [re.sub(lyrics_cleaning_expression, '', i.get_text(' ').strip()) for i in soup.find_all(is_lyrics_container)]
print(lyrics_elements)

