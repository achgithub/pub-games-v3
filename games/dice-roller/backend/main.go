package main

import (
	"encoding/json"
	"log"
	"math/rand"
	"net/http"
	"strconv"
)

type RollResponse struct {
	Values []int `json:"values"`
}

func handleRoll(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Access-Control-Allow-Origin", "*")
	w.Header().Set("Content-Type", "application/json")

	count, err := strconv.Atoi(r.URL.Query().Get("count"))
	if err != nil || count < 1 {
		count = 1
	}
	if count > 6 {
		count = 6
	}

	values := make([]int, count)
	for i := range values {
		values[i] = rand.Intn(6) + 1
	}

	json.NewEncoder(w).Encode(RollResponse{Values: values})
}

func main() {
	http.HandleFunc("/api/roll", handleRoll)
	http.Handle("/", http.FileServer(http.Dir("./static")))
	log.Println("Dice Roller running on :4081")
	log.Fatal(http.ListenAndServe(":4081", nil))
}
