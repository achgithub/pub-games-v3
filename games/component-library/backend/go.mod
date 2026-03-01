module github.com/achgithub/pub-games-v3/games/component-library/backend

go 1.25

require (
	github.com/achgithub/activity-hub-common v0.0.0
	github.com/go-redis/redis/v8 v8.11.5
	github.com/gorilla/handlers v1.5.2
	github.com/gorilla/mux v1.8.1
	github.com/lib/pq v1.10.9
)

replace github.com/achgithub/activity-hub-common => ../../../lib/activity-hub-common
