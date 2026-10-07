const app = require('./app')

const PORT = process.env.PORT || 3000

app.listen(PORT, () => {
  console.log("Cafeteria API rodando em http://localhost:" + PORT)
})
