document.addEventListener('DOMContentLoaded', function() {
    var menuButton = document.querySelector('.menu-button');
    var sideMenu = document.getElementById('sideMenu');

    menuButton.onclick = function() {
        if (sideMenu.style.width == '450px') {
            sideMenu.style.width = '0';
        } else {
            sideMenu.style.width = '450px';
        }
    };

    window.onclick = function(event) {
        if (!event.target.matches('.menu-button') && !event.target.matches('.side-menu a')) {
            sideMenu.style.width = "0";
        }
    }
});