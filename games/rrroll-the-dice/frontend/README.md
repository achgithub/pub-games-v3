# Rrroll the Dice - Frontend POC

Quick proof of concept for dice rolling animation.

## Adding Dice Images

Place your dice images in `public/dice/` with these filenames:
- `dice-1.png` - One dot
- `dice-2.png` - Two dots
- `dice-3.png` - Three dots
- `dice-4.png` - Four dots
- `dice-5.png` - Five dots
- `dice-6.png` - Six dots

Images should be square, ideally 400x400px or similar high resolution.

## Running the POC

```bash
cd frontend
npm install
npm start
```

Opens on http://localhost:3000

## Animation Features

- **Rolling**: Dice shake/rotate and cycle through random values for 1.5 seconds
- **Blur effect**: Adds motion blur during roll
- **Settle animation**: Smooth scale-in when landing on final value
- **Fallback**: Shows Unicode dice emoji if images don't load

## Controls

- **▼/▲ buttons**: Remove/add dice (min 1, max 6)
- **Roll button**: Triggers the animation
- Displays total of all dice when not rolling
