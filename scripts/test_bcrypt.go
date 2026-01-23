package main

import (
	"fmt"
	"golang.org/x/crypto/bcrypt"
)

func main() {
	// Generate a fresh hash for "123456"
	hash, err := bcrypt.GenerateFromPassword([]byte("123456"), bcrypt.DefaultCost)
	if err != nil {
		panic(err)
	}
	fmt.Println("Fresh hash for '123456':")
	fmt.Println(string(hash))
	fmt.Println()

	// Test the hash from our schema.sql
	schemaHash := "$2a$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewY5NU8YOc8KLKEK"
	fmt.Println("Testing schema hash:", schemaHash)
	err = bcrypt.CompareHashAndPassword([]byte(schemaHash), []byte("123456"))
	if err != nil {
		fmt.Println("❌ Schema hash DOES NOT match '123456':", err)
	} else {
		fmt.Println("✅ Schema hash MATCHES '123456'")
	}
}
