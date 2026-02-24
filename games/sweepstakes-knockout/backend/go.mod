module pub-games-v3/games/sweepstakes-knockout/backend

go 1.25

require (
	github.com/gorilla/handlers v1.5.2
	github.com/gorilla/mux v1.8.1
	github.com/lib/pq v1.10.9
	pub-games-v3/lib/activity-hub-common v0.0.0
)

replace pub-games-v3/lib/activity-hub-common => ../../../lib/activity-hub-common

require (
	github.com/felixge/httpsnoop v1.0.3 // indirect
	github.com/golang-jwt/jwt/v5 v5.2.0 // indirect
)
