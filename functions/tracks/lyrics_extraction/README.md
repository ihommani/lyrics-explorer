```
curl -X POST localhost:8080 \
   -H "Content-Type: application/cloudevents+json" \
   -d '{
	"bucket" : "ihommani-html-bucket",
	"file" : "rap/diams/2006-06-02/dans_ma_bulle/la_boullette.html"
}'
```

gcloud functions deploy hello_cloud_event --runtime python38 --trigger-resource=ihommani-html-bucket --update-labels=type=todelete --trigger-event google.storage.object.finalize