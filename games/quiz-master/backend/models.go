package main

import "time"

type Session struct {
	ID          int        `json:"id"`
	PackID      int        `json:"packId"`
	Name        string     `json:"name"`
	Mode        string     `json:"mode"`
	Status      string     `json:"status"`
	JoinCode    string     `json:"joinCode"`
	CreatedBy   string     `json:"createdBy"`
	CreatedAt   time.Time  `json:"createdAt"`
	StartedAt   *time.Time `json:"startedAt"`
	CompletedAt *time.Time `json:"completedAt"`
}

type Team struct {
	ID        int    `json:"id"`
	SessionID int    `json:"sessionId"`
	Name      string `json:"name"`
	JoinCode  string `json:"joinCode"`
}

type Player struct {
	ID        int    `json:"id"`
	UserEmail string `json:"userEmail"`
	UserName  string `json:"userName"`
	TeamID    *int   `json:"teamId"`
	TeamName  string `json:"teamName"`
}

type Round struct {
	ID               int    `json:"id"`
	RoundNumber      int    `json:"roundNumber"`
	Name             string `json:"name"`
	Type             string `json:"type"`
	TimeLimitSeconds int    `json:"timeLimitSeconds"`
	QuestionCount    int    `json:"questionCount"`
}

type Question struct {
	ID        int    `json:"id"`
	Position  int    `json:"position"`
	Text      string `json:"text"`
	Answer    string `json:"answer"`
	Type      string `json:"type"`
	ImagePath string `json:"imagePath"`
	AudioPath string `json:"audioPath"`
}

type AnswerWithLikely struct {
	ID             int    `json:"id"`
	PlayerID       int    `json:"playerId"`
	TeamID         *int   `json:"teamId"`
	PlayerEmail    string `json:"playerEmail"`
	PlayerName     string `json:"playerName"`
	TeamName       string `json:"teamName"`
	AnswerText     string `json:"answerText"`
	IsCorrect      *bool  `json:"isCorrect"`
	Points         int    `json:"points"`
	IsLikelyCorrect bool  `json:"isLikelyCorrect"`
}
