function playPause()
{
    var music = document.getElementById('music');
    var music_btn = document.getElementById('music_btn');
    if (music.paused)
    {
        music.play();
        music_btn.className = 'fas fa-times';
    }
    else
    {
        music.pause();
        music_btn.className = 'fas fa-music';
    }
}