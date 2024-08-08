let loginForm = document.getElementById("form-login");
loginForm.addEventListener("submit", (e) => {
    e.preventDefault();
    let username = e.target.elements.username.value;
    let password = e.target.elements.password.value;
    console.log(username, password);
    fetch("http://localhost:8000/login", {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
        },
        body: JSON.stringify({ username, password }),
    })
        .then((responese) => {
            return responese.json();
        })
        .then((data) => {
            console.log(data);
            const { uid, username } = data.user;
            if (uid) {
                window.location.href = `/chat`;
            } else {
                alert("Login failed");
            }
        });
});
