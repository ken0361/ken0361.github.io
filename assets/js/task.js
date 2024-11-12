var config = {
    apiKey: "AIzaSyAU96hFLomAtATR2diOSq4-_rJBWr_g5zE",
    authDomain: "ken-github.firebaseapp.com",
    databaseURL: "https://ken-github-default-rtdb.asia-southeast1.firebasedatabase.app/",
    projectId: "ken-github",
    storageBucket: "ken-github.firebasestorage.app",
    messagingSenderId: "501229830621",
    appId: "1:501229830621:web:abd5664f0138164f6d7634",
    measurementId: "G-V24YXHSMDD"
};
firebase.initializeApp(config);
var db = firebase.database();

var get_start = (function ()
{
    function init()
    {
        _getData();
    }

    return {
        init
    }

})();

var showCompletedToDo = true;
function showCompleted()
{
    if (showCompletedToDo)
    {
        showCompletedToDo = false;
        show.innerHTML = `<i onclick="showCompleted()" class='bx bx-low-vision bx-sm'></i>`;
    }
    else
    {
        showCompletedToDo = true;
        show.innerHTML = `<i onclick="showCompleted()" class='bx bx-show bx-sm'></i>`;
    }
    _getData();
}

// get and display data
function _getData()
{
    db.ref(`/todo`).once('value').then((snapshot) => {
        var data = snapshot.val();
        if (data)
        {
            var allData = [];
            var len = 0;

            for (let key in data) {
                var obj = {
                    key: key,
                    event: data[key].event,
                    date: data[key].date,
                    complete: data[key].complete
                };
                allData.push(obj);
                len ++;
            }
            allData.sort((a,b) => Date.parse(b.date) - Date.parse(a.date));
            _createPageStr(len, allData);
        }
        else
        {
            _createPageStr(0, []);
        }
    });
}

function _createPageStr(len, allData)
{
    var str = `<div class="container">`;
    for (i = 0; i < len; i++)
    {
        var style = ``;
        var check = ``;
        if (!showCompletedToDo && allData[i].complete) continue;
        if (allData[i].complete)
        {
            style = `style="background: #aaa; color: #fff; text-decoration: line-through;"`;
            check = `<i class='bx bx-check'></i>`;
        }

        str += `
            <div class="card border border-dark" onclick="handleCardClick('${allData[i].key}', ${allData[i].complete})">
                <div class="card-body" ${style}>
                    <h5 class="card-text fs-5 fw-bold">${check}${allData[i].event}</h5>
                    <h6 class="card-text text-muted" style="position: absolute; button: 3px; right: 5px; text-align:right; font-size: 12px;">${allData[i].date}</h6>
                    <i onclick="handleDeleteClick(event, '${allData[i].key}')" class="bx bx-x bx-md bx-tada-hover text-primary" style="position: absolute; top: 1px; right: 1px;"></i>
                </div>
            </div>
            `;
    }

    str += `</div>`
    allBackUp.innerHTML = str;
}

function handleCardClick(key, status)
{
    if (status == true)
    {
        db.ref(`/todo/${key}/complete`).set(false);
    }
    else
    {
        db.ref(`/todo/${key}/complete`).set(true);
    }
    _getData();
}

function handleKeyPress(event) {
    
    if (event.keyCode === 13)
    {
        insertToDo();
    }
}

function insertToDo()
{
    var event = $(`#todo`).val();
    var date = $(`#date`).val();
    if (date == "")
    {
        date = _DateTimezone(8);
    }
    if (event != "")
    {
        db.ref(`/todo`).push({
            date: date,
            event: event,
            complete: false
        });
        $('#insertToDoForm')[0].reset();
        _getData();
    }
}

// delete event
function handleDeleteClick(event, key)
{
    event.stopPropagation();
    db.ref(`/todo/${key}`).remove();
    _getData();
}

function _DateTimezone(offset)
{
    d = new Date();
    utc = d.getTime() + (d.getTimezoneOffset() * 60000);
    return new Date(utc + (3600000 * offset)).toLocaleDateString();
}
