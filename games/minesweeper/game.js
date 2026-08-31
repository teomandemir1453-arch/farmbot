const board = document.getElementById("board");
const mineCountText = document.getElementById("mineCount");
const timerText = document.getElementById("timer");
const scoreText = document.getElementById("score");
const restartBtn = document.getElementById("restartBtn");


const SIZE = 8;
const MINES = 10;


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

    timerText.textContent = "00:00";


    clearInterval(timer);

    timer = setInterval(()=>{

        time++;

        let min = Math.floor(time / 60);
        let sec = time % 60;

        timerText.textContent =
        `${String(min).padStart(2,"0")}:${String(sec).padStart(2,"0")}`;

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
