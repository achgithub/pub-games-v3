module github.com/achgithub/activity-hub/sweepstakes

go 1.25

require (
	github.com/achgithub/activity-hub-common v0.1.1
	github.com/gorilla/handlers v1.5.2
	github.com/gorilla/mux v1.8.1
)

replace github.com/achgithub/activity-hub-common => ../../../lib/activity-hub-common
