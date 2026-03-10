module bulls-and-cows

go 1.25

require (
	github.com/achgithub/activity-hub-common v0.1.1
	github.com/go-redis/redis/v8 v8.11.5
	github.com/google/uuid v1.3.0
	github.com/gorilla/mux v1.8.0
	github.com/lib/pq v1.10.7
	github.com/rs/cors v1.8.2
)

replace github.com/achgithub/activity-hub-common => ../../../lib/activity-hub-common
