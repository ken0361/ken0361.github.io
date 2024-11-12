// Initialize Firebase
const firebaseConfig = {
    apiKey: "APIKEY_PLACEHOLDER",
    authDomain: "ken-github.firebaseapp.com",
    databaseURL: "https://ken-github-default-rtdb.asia-southeast1.firebasedatabase.app/",
    projectId: "ken-github",
    storageBucket: "ken-github.firebasestorage.app",
    messagingSenderId: "501229830621",
    appId: "1:501229830621:web:abd5664f0138164f6d7634",
    measurementId: "G-V24YXHSMDD"
};
firebase.initializeApp(firebaseConfig);
var db = firebase.database();

var allComments = document.querySelector("#allComments");

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

// Click button update db
$('input:button').click(function(){
    var name = $('#add-name').val(),
        content = $('#add-content').val();
        if (name != "" && content != "") {
            db.ref(`/comments`).push({
                name : name,
                content: content,
                status: "",
                type: "",
                upvote: 0,
                downvote: 0,
                time: _DateTimezone(8)
            });
        }
    $('#myForm')[0].reset();
    _getData();
});

// get and display data
function _getData() {
    db.ref(`/comments`).once('value').then((snapshot) => {
        var data = snapshot.val();
        if (data) {
            var names = [];
            var contents = [];
            var times = [];
            var len = 0;

            for (let key in data) {
                names.push(data[key].name);
                contents.push(data[key].content);
                times.push(data[key].time);
                len ++;
            }
            _createPageStr(len, names, contents, times);
        }
        else {
            db.ref(`/cmtCnt`).set(0);
            cmtCnt.innerHTML = 0;
        }
    });
}

// update to page
function _createPageStr(len, names, contents, times) {
    var str = `<div class="container" style="text-align: left;">`;
        var i = 0;
        var style = "";
        for (i = len-1; i >= 0; i--) {
            str += `
                <div class="card border border-dark">
                    <div class="card-body">
                        <h5 class="card-title fs-6 fw-bold ${style}">${names[i]}</h5>
                        <h6 class="card-text fs-7" style="position: absolute; top: 3px; right: 5px; text-align:right;">#${i+1}</h6>
                        <h6 class="card-text text-muted" style="position: absolute; top: 30px; right: 5px; text-align:right; font-size: 10px;">${times[i]}</h6>
                        <hr class="dropdown-divider">
                        <p class="card-text fs-6 fw-bold">${contents[i]}</p>
                    </div>
                </div>
                `;
            style = ""
        }
        str += `</div>`
        allComments.innerHTML = str;
        db.ref(`/cmtCnt`).set(len);
        cmtCnt.innerHTML = len;    
}

// time
function _DateTimezone(offset)
{
    d = new Date();
    utc = d.getTime() + (d.getTimezoneOffset() * 60000);
    return new Date(utc + (3600000 * offset)).toLocaleDateString();
}
