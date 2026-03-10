module bulls-and-cows

go 1.25

replace activity-hub-common => ../../../lib/activity-hub-common

require activity-hub-common v0.0.0

require (
	github.com/go-redis/redis/v8 v8.11.5
	github.com/google/uuid v1.3.0
	github.com/gorilla/mux v1.8.0
	github.com/lib/pq v1.10.7
	github.com/rs/cors v1.8.2
)
