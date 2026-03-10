package main

import (
	"fmt"
	"math/rand"
	"strings"
	"time"
)

// Color options for color mode
var colorOptions = []string{"R", "B", "G", "Y", "O", "P"} // Red, Blue, Green, Yellow, Orange, Purple

// GenerateSecretCode creates a random 4-character code based on mode
// mode: "colors" or "numbers"
func GenerateSecretCode(mode string) string {
	rand.Seed(time.Now().UnixNano())
	code := ""

	if mode == "colors" {
		// Generate 4 random colors (duplicates allowed)
		for i := 0; i < 4; i++ {
			code += colorOptions[rand.Intn(len(colorOptions))]
		}
	} else {
		// Generate 4 random digits (duplicates allowed)
		for i := 0; i < 4; i++ {
			code += fmt.Sprintf("%d", rand.Intn(10))
		}
	}

	return code
}

// ValidateGuess checks if a guess is valid for the given mode
func ValidateGuess(guess, mode string) error {
	// Must be exactly 4 characters
	if len(guess) != 4 {
		return fmt.Errorf("guess must be exactly 4 characters")
	}

	guess = strings.ToUpper(guess)

	if mode == "colors" {
		// Each character must be a valid color
		for _, char := range guess {
			valid := false
			for _, color := range colorOptions {
				if string(char) == color {
					valid = true
					break
				}
			}
			if !valid {
				return fmt.Errorf("invalid color: %c (must be R, B, G, Y, O, or P)", char)
			}
		}
	} else {
		// Each character must be a digit
		for _, char := range guess {
			if char < '0' || char > '9' {
				return fmt.Errorf("invalid digit: %c (must be 0-9)", char)
			}
		}
	}

	return nil
}

// CalculateBullsAndCows scores a guess against the secret code
// Bulls: correct color/number in correct position
// Cows: correct color/number in wrong position
func CalculateBullsAndCows(secret, guess string) (bulls, cows int) {
	secret = strings.ToUpper(secret)
	guess = strings.ToUpper(guess)

	// Track which positions are bulls
	secretUsed := make([]bool, len(secret))
	guessUsed := make([]bool, len(guess))

	// First pass: count bulls (exact matches)
	for i := 0; i < len(guess); i++ {
		if guess[i] == secret[i] {
			bulls++
			secretUsed[i] = true
			guessUsed[i] = true
		}
	}

	// Second pass: count cows (correct but wrong position)
	for i := 0; i < len(guess); i++ {
		if guessUsed[i] {
			continue // Skip bulls
		}
		for j := 0; j < len(secret); j++ {
			if secretUsed[j] {
				continue // Skip already matched
			}
			if guess[i] == secret[j] {
				cows++
				secretUsed[j] = true
				break
			}
		}
	}

	return bulls, cows
}

// CheckWin determines if the guess is a winning guess
func CheckWin(bulls int) bool {
	return bulls == 4
}
