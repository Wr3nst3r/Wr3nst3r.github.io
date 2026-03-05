<!DOCTYPE html>
<html>
<head>
    <title>Steve's Ball Game</title>
    <script src="https://unpkg.com/react@17/umd/react.development.js" crossorigin></script>
    <script src="https://unpkg.com/react-dom@17/umd/react-dom.development.js" crossorigin></script>
    <style>
        body {
            font-family: Arial, sans-serif;
            display: flex;
            justify-content: center;
            align-items: center;
            height: 100vh;
            background-color: #f0f0f0;
        }
        #game {
            width: 300px;
            height: 300px;
            border: 1px solid #000;
            position: relative;
            overflow: hidden;
        }
    </style>
</head>
<body>
    <div id="root"></div>
    <script>
        const BallGame = () => {
            const [score, setScore] = React.useState(0);
            const [ballPosition, setBallPosition] = React.useState({ x: 150, y: 150 });

            const moveBall = () => {
                const newX = Math.floor(Math.random() * 250);
                const newY = Math.floor(Math.random() * 250);
                setBallPosition({ x: newX, y: newY });
                setScore(prevScore => prevScore + 1);
            };

            return (
                <div>
                    <h1>Steve's Ball Game</h1>
                    <h2>Score: {score}</h2>
                    <div 
                        id="game" 
                        onClick={moveBall
                        } 
                        style={{
                            left: ballPosition.x,
                            top: ballPosition.y,
                            position: 'absolute',
                            backgroundColor: 'red',
                            width: '50px',
                            height: '50px',
                            borderRadius: '50%',
                        }}
                    ></div>
                </div>
            );
        };

        ReactDOM.render(<BallGame />, document.getElementById('root'));
    </script>
</body>
</html>