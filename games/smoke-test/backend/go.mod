module github.com/achgithub/pub-games-v3/games/smoke-test/backend

go 1.25

require (
	github.com/achgithub/activity-hub-common v0.0.0
	github.com/gorilla/handlers v1.5.2
	github.com/gorilla/mux v1.8.1
	github.com/lib/pq v1.10.9
	github.com/redis/go-redis/v9 v9.7.0
)

replace github.com/achgithub/activity-hub-common => ../../../lib/activity-hub-common
