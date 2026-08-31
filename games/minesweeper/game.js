const board = document.getElementById("board");
const mineCountText = document.getElementById("mineCount");
const timerText = document.getElementById("timer");
const scoreText = document.getElementById("score");
const restartBtn = document.getElementById("restartBtn");

const GAME_REWARD = 0.00020;
const DAILY_LIMIT = 3;

let lastPlayDate = localStorage.getItem("lastPlayDate");

const GAME_TIME = 30;
const WIN_TARGET = 20;
const MINES = 5;

const SIZE = 8;

let timeLeft = GAME_TIME;
let timerInterval = null;
let dailyPlays = Number(localStorage.getItem("dailyPlays")) || 0;
let gameEarnings = Number(localStorage.getItem("gameEarnings")) || 0;
let cells = [];
let mines = [];
let opened = 0;
let score = 0;
let time = 0;
let timer = null;
let gameOver = false;


function startGame(){

    board.innerHTML = "";

    cells = [];
    mines = [];

    opened = 0;
    score = 0;
    time = 0;
    gameOver = false;


    scoreText.textContent = "0";
    mineCountText.textContent = MINES;

timeLeft = GAME_TIME;

timerText.textContent = timeLeft;


clearInterval(timerInterval);

timerInterval = setInterval(()=>{

    timeLeft--;

    timerText.textContent = timeLeft;


    if(timeLeft <= 0){

        clearInterval(timerInterval);

        endGame(false);

    }

},1000);
    createMines();

    createBoard();

}



function createMines(){

    while(mines.length < MINES){

        let pos = Math.floor(Math.random() * SIZE * SIZE);

        if(!mines.includes(pos)){
            mines.push(pos);
        }

    }

}



function createBoard(){


    for(let i=0;i<SIZE*SIZE;i++){


        let cell=document.createElement("div");

        cell.className="cell";

        cell.dataset.index=i;


        cell.addEventListener("click",()=>{

            openCell(i);

        });


        cell.addEventListener("contextmenu",(e)=>{

            e.preventDefault();

            flagCell(cell);

        });



        board.appendChild(cell);

        cells.push(cell);

    }

}





function openCell(index){


    if(gameOver) return;


    let cell=cells[index];


    if(cell.classList.contains("open") ||
       cell.classList.contains("flag"))
       return;



    if(mines.includes(index)){


        cell.classList.add("mine");

        cell.innerHTML="💣";


        endGame(false);

        return;

    }



    reveal(index);
    
    
showReward(cells[index]);
    
    score += 10;

    scoreText.textContent=score;



    if(opened === SIZE*SIZE-MINES){

        endGame(true);

    }


}




function reveal(index){


    let cell=cells[index];


    if(cell.classList.contains("open"))
        return;


    if(mines.includes(index))
        return;



    cell.classList.add("open");

    opened++;



    let nearby=countMines(index);


    if(nearby>0){

        cell.innerHTML=nearby;

    }
    else{


        getNeighbours(index).forEach(n=>{

            reveal(n);

        });


    }


}




function countMines(index){


    let count=0;


    getNeighbours(index).forEach(n=>{

        if(mines.includes(n))
            count++;

    });


    return count;

}




function getNeighbours(index){


    let result=[];


    let x=index % SIZE;

    let y=Math.floor(index/SIZE);



    for(let dx=-1;dx<=1;dx++){

        for(let dy=-1;dy<=1;dy++){


            if(dx===0 && dy===0)
                continue;


            let nx=x+dx;
            let ny=y+dy;


            if(nx>=0 && nx<SIZE &&
               ny>=0 && ny<SIZE){


                result.push(ny*SIZE+nx);

            }

        }

    }


    return result;

}




function flagCell(cell){


    if(gameOver) return;


    if(cell.classList.contains("open"))
        return;


    if(cell.classList.contains("flag")){

        cell.classList.remove("flag");

        cell.innerHTML="";

    }
    else{

        cell.classList.add("flag");

        cell.innerHTML="🚩";

    }


}





function endGame(win){


    gameOver=true;


    clearInterval(timer);



if(win){

showReward(cells[Math.floor(Math.random()*cells.length)]);

giveGameReward();
        setTimeout(()=>{

            alert(
            "💎 Congratulations!\n\nScore: "+score
            );

        },300);

    }
    else{


        cells.forEach((cell,i)=>{

            if(mines.includes(i)){

                cell.classList.add("mine");

                cell.innerHTML="💣";

            }

        });


        setTimeout(()=>{

            alert(
            "💥 BOOM!\nTry again"
            );

        },300);

    }


}




restartBtn.addEventListener("click",startGame);



startGame();
function showReward(cell){

    let reward = document.createElement("div");

    let items=[
        "💎",
        "💎",
        "₿",
        "✨"
    ];


    reward.className="reward";

    reward.innerHTML=
    items[Math.floor(Math.random()*items.length)];


    let rect=cell.getBoundingClientRect();


    reward.style.left=
    rect.left+"px";


    reward.style.top=
    rect.top+"px";


    document.body.appendChild(reward);



    setTimeout(()=>{

        reward.remove();

    },1200);

}
function checkDailyLimit(){

    let today = new Date().toDateString();


    if(lastPlayDate !== today){

        dailyPlays = 0;

        localStorage.setItem(
            "lastPlayDate",
            today
        );

        localStorage.setItem(
            "dailyPlays",
            0
        );

    }


    updateWallet();


    if(dailyPlays >= DAILY_LIMIT){

        alert(
        "🎮 Günlük oyun hakkın bitti.\nYarın tekrar deneyebilirsin."
        );

        return false;

    }


    return true;

}



function usePlay(){

    dailyPlays++;

    localStorage.setItem(
        "dailyPlays",
        dailyPlays
    );

    updateWallet();

}



function updateWallet(){

    let remaining =
    DAILY_LIMIT - dailyPlays;


    let daily =
    document.getElementById("dailyPlays");


    let earnings =
    document.getElementById("gameEarnings");



    if(daily){

        daily.innerHTML =
        remaining + "/" + DAILY_LIMIT;

    }



    if(earnings){

        earnings.innerHTML =
        gameEarnings.toFixed(5);

    }

}




function giveGameReward(){


    gameEarnings += GAME_REWARD;


    localStorage.setItem(
        "gameEarnings",
        gameEarnings
    );



    document.getElementById(
        "rewardAmount"
    ).innerHTML =
    (GAME_REWARD*100).toFixed(5)+" cent"



    document.getElementById(
        "rewardPopup"
    ).classList.add("show");



    updateWallet();

}





document
.getElementById("playAgain")
.addEventListener("click",()=>{


    document
    .getElementById("rewardPopup")
    .classList.remove("show");


    if(checkDailyLimit()){

        usePlay();

        startGame();

    }


});





document
.getElementById("addInvestment")
.addEventListener("click",()=>{


    let totalInvestment =
    Number(localStorage.getItem("totalInvestment")) || 0;


    totalInvestment += gameEarnings;



    localStorage.setItem(
        "totalInvestment",
        totalInvestment
    );



    gameEarnings = 0;



    localStorage.setItem(
        "gameEarnings",
        0
    );



    updateWallet();



    alert(
    "💎 Kazanç Total Investment'a eklendi!"
    );



    document
    .getElementById("rewardPopup")
    .classList.remove("show");


});



checkDailyLimit();
updateWallet();
