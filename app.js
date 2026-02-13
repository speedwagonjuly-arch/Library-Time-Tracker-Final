/* =========================
   DATE HELPERS
========================= */
function formatDateTime(date){
    const d = new Date(date);

    const day   = String(d.getDate()).padStart(2,'0');
    const month = String(d.getMonth()+1).padStart(2,'0');
    const year  = d.getFullYear();

    const h = String(d.getHours()).padStart(2,'0');
    const m = String(d.getMinutes()).padStart(2,'0');
    const s = String(d.getSeconds()).padStart(2,'0');

    return `${day}/${month}/${year} ${h}:${m}:${s}`;
}

function parseDateTime(str){
    const [date, time] = str.split(" ");
    const [d,m,y] = date.split("/").map(Number);
    const [h,n,s] = time.split(":").map(Number);
    return new Date(y, m-1, d, h, n, s);
}

function formatDuration(start,end){
    let sec = Math.floor((end-start)/1000);

    const hrs = Math.floor(sec / 3600);
    sec -= hrs * 3600;

    const mins = Math.floor(sec / 60);
    sec -= mins * 60;

    return `${hrs} hrs ${mins} mins ${sec} secs`;
}

/* =========================
   STORAGE
========================= */
class Storage{
    static getLogs(){ return JSON.parse(localStorage.getItem("logs") || "[]"); }
    static saveLogs(l){ localStorage.setItem("logs", JSON.stringify(l)); }
}

/* =========================
   STUDENT APP
========================= */
class App{

    static timeIn(){
        let f=fName.value.trim();
        let l=lName.value.trim();

        if(!f||!l)
            return UI.message("studentMsg","Enter name","red");

        let logs = Storage.getLogs();

        // prevent double time-in
        let active = [...logs].reverse().find(
            x=>x.first===f && x.last===l && !x.timeOut
        );

        if(active)
            return UI.message("studentMsg","You already have an active session. Please Time-Out first.","red");

        logs.push({
            first:f,
            last:l,
            timeIn:formatDateTime(new Date()),
            timeOut:"",
            consumed:""
        });

        Storage.saveLogs(logs);

        UI.message("studentMsg","Timed In","green");
    }

    static timeOut(){
        let f=fName.value.trim();
        let l=lName.value.trim();

        if(!f||!l)
            return UI.message("studentMsg","Enter name","red");

        let logs = Storage.getLogs();

        let log = [...logs].reverse().find(
            x=>x.first===f && x.last===l && !x.timeOut
        );

        if(!log)
            return UI.message("studentMsg","No open session","red");

        const now = new Date();
        const start = parseDateTime(log.timeIn);

        // enforce 15-minute minimum stay
        const MIN = 15*60*1000;
        const elapsed = now - start;

        if(elapsed < MIN){
            const minsLeft = Math.ceil((MIN - elapsed)/60000);
            return UI.message("studentMsg",
                `Minimum stay is 15 mins. Wait ${minsLeft} more minute(s).`,
                "red"
            );
        }

        log.timeOut = formatDateTime(now);
        log.consumed = formatDuration(start, now);

        Storage.saveLogs(logs);

        UI.message("studentMsg","Timed Out","green");
    }
}

/* =========================
   ADMIN
========================= */
class Admin{

    static login(){
        if(adminUser.value==="admin" && adminPass.value==="password"){
            sessionStorage.setItem("admin","1");
            btnCalc.classList.remove("hidden");
            UI.showAdminPanel();
        }
        else UI.message("adminLoginMsg","Invalid login","red");
    }

    static logout(){
        sessionStorage.removeItem("admin");
        btnCalc.classList.add("hidden");
        UI.showStudent();
    }

    static renderLogs(){
        const logsContainer = document.getElementById("logsContainer");

        if(!logsContainer) return;

        let logs = Storage.getLogs();

        let html = `<table>
        <tr>
            <th>First</th>
            <th>Last</th>
            <th>Time In</th>
            <th>Time Out</th>
            <th>Consumed</th>
        </tr>`;

        logs.forEach(l=>{
            html += `
            <tr>
                <td>${l.first}</td>
                <td>${l.last}</td>
                <td>${l.timeIn}</td>
                <td>${l.timeOut}</td>
                <td>${l.consumed}</td>
            </tr>`;
        });

        html += "</table>";

        logsContainer.innerHTML = html;
    }

    /* ==== CRASH-PROOF CSV EXPORT ==== */
    static exportCSV(){

        try{

            let logs = Storage.getLogs();

            if(!logs || !Array.isArray(logs) || logs.length === 0){
                alert("There are no logs to export yet.");
                return;
            }

            let csv = "First,Last,Time In,Time Out,Consumed\n";

            logs.forEach(l => {

                const first = `"${(l.first||"").replace(/"/g,'""')}"`;
                const last  = `"${(l.last||"").replace(/"/g,'""')}"`;
                const tin   = `"${(l.timeIn||"").replace(/"/g,'""')}"`;
                const tout  = `"${(l.timeOut||"").replace(/"/g,'""')}"`;
                const cons  = `"${(l.consumed||"").replace(/"/g,'""')}"`;

                csv += `${first},${last},${tin},${tout},${cons}\n`;
            });

            const d=new Date();
            const mm=String(d.getMonth()+1).padStart(2,'0');
            const dd=String(d.getDate()).padStart(2,'0');
            const yy=d.getFullYear();

            const filename = `STILibrary ${mm}-${dd}-${yy}.csv`;

            const blob = new Blob([csv],{type:"text/csv;charset=utf-8;"});
            const url = URL.createObjectURL(blob);

            const a=document.createElement("a");
            a.href=url;
            a.download=filename;
            document.body.appendChild(a);
            a.click();

            document.body.removeChild(a);
            URL.revokeObjectURL(url);

        }catch(err){
            console.error(err);
            alert("Export failed — but your data is safe.");
        }
    }

    static clearLogs(){
        if(!confirm("Delete ALL logs?")) return;
        localStorage.removeItem("logs");
        Admin.renderLogs();
    }
}

/* =========================
   CALCULATOR
========================= */
class Calculator{

    static async process(){

        let files = fileUpload.files;
        let f = searchFirst.value.trim();
        let l = searchLast.value.trim();

        if(!files.length)
            return UI.message("calcResult","Please upload log CSV files.","red");

        if(!f || !l)
            return UI.message("calcResult","Enter student name.","red");

        let totalSeconds = 0;

        for(let file of files){

            let text = await file.text();

            let lines = text.split("\n").slice(1); // skip header

            lines.forEach(line => {

                if(!line.trim()) return;

                let cols = line.split(",");

                if(cols.length < 5) return;

                let first = cols[0].replace(/"/g,"").trim();
                let last  = cols[1].replace(/"/g,"").trim();
                let consumed = cols[4].replace(/"/g,"").trim();

                // filter name match
                if(first.toLowerCase()===f.toLowerCase()
                && last.toLowerCase()===l.toLowerCase()){

                    // Example consumed format:
                    // "1 hrs 30 mins 10 secs"
                    let h = (consumed.match(/(\d+)\s*hrs/)||[0,0])[1];
                    let m = (consumed.match(/(\d+)\s*mins/)||[0,0])[1];
                    let s = (consumed.match(/(\d+)\s*secs/)||[0,0])[1];

                    totalSeconds += (+h)*3600 + (+m)*60 + (+s);
                }
            });
        }

        if(totalSeconds === 0)
            return UI.message("calcResult","No records found for this student.","red");

        // convert total seconds back to readable
        let hrs = Math.floor(totalSeconds/3600);
        totalSeconds -= hrs*3600;

        let mins = Math.floor(totalSeconds/60);
        let secs = totalSeconds - mins*60;

        UI.message(
            "calcResult",
            `Total Time: ${hrs} hrs ${mins} mins ${secs} secs`,
            "green"
        );
    }
}


/* =========================
   UI MANAGER
========================= */
class UI{

    static pulse(btn){
        btn.classList.add("activePulse");
        setTimeout(()=>btn.classList.remove("activePulse"),400);
    }

    static resetNav(){
        [btnStudent,btnAdmin,btnCalc].forEach(b=>b.classList.remove("active"));
    }

    static hideAll(){
        [studentSection,adminLogin,adminPanel,calculatorSection]
        .forEach(x=>x.classList.add("hidden"));
    }

    static showStudent(){
        this.hideAll(); this.resetNav();
        btnStudent.classList.add("active");
        studentSection.classList.remove("hidden");
    }

    static showAdminLogin(){
        this.hideAll(); this.resetNav();
        btnAdmin.classList.add("active");
        adminLogin.classList.remove("hidden");
    }

    static showAdminPanel(){
        this.hideAll(); this.resetNav();
        btnAdmin.classList.add("active");
        adminPanel.classList.remove("hidden");
        Admin.renderLogs();
    }

    static showCalculator(){
        if(!sessionStorage.getItem("admin")) return;
        this.hideAll(); this.resetNav();
        btnCalc.classList.add("active");
        calculatorSection.classList.remove("hidden");
    }

    static message(id,text,color){
        let el=document.getElementById(id);
        el.style.color=color;
        el.textContent=text;
        setTimeout(()=>el.textContent="",2500);
    }
}

/* =========================
   INIT
========================= */
if(sessionStorage.getItem("admin"))
    btnCalc.classList.remove("hidden");

UI.showStudent();