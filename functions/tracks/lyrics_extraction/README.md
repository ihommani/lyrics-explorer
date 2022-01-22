```
curl -X POST localhost:8080 \
   -H "Content-Type: application/cloudevents+json" \
   -d '{
	"bucket" : "ihommani-html-bucket",
	"file" : "rap/diams/2006-06-02/dans_ma_bulle/la_boullette.html"
}'
```