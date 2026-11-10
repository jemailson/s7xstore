package com.s7x.proxyapp

import android.content.Intent
import android.os.Bundle
import android.provider.Settings
import android.widget.Button
import android.widget.EditText
import android.widget.Toast
import androidx.appcompat.app.AppCompatActivity
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import okhttp3.OkHttpClient
import okhttp3.Request

class LoginActivity : AppCompatActivity() {
    companion object {
        var BASE_URL = "http://10.0.2.2:3333"
    }

    private val client = OkHttpClient()

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_login)

        val keyInput = findViewById<EditText>(R.id.editKey)
        val enterBtn = findViewById<Button>(R.id.btnEnter)

        enterBtn.setOnClickListener {
            val key = keyInput.text.toString().trim()
            if (key.isEmpty()) {
                Toast.makeText(this, "Digite a chave de acesso", Toast.LENGTH_SHORT).show()
                return@setOnClickListener
            }

            val androidId = Settings.Secure.getString(contentResolver, Settings.Secure.ANDROID_ID)
            validateKey(key, androidId)
        }
    }

    private fun validateKey(key: String, deviceId: String) {
        CoroutineScope(Dispatchers.IO).launch {
            try {
                val url = "${'$'}{BASE_URL}/CheckLogin.php?user=${'$'}{key}&uid=${'$'}{deviceId}"
                val req = Request.Builder().url(url).get().build()
                val res = client.newCall(req).execute()
                val body = res.body?.string() ?: ""

                if (res.isSuccessful) {
                    runOnUiThread {
                        Toast.makeText(this@LoginActivity, "Login bem-sucedido", Toast.LENGTH_SHORT).show()
                        val intent = Intent(this@LoginActivity, MainActivity::class.java)
                        startActivity(intent)
                        finish()
                    }
                } else {
                    runOnUiThread {
                        Toast.makeText(this@LoginActivity, body.ifEmpty { "Chave inválida" }, Toast.LENGTH_SHORT).show()
                    }
                }
            } catch (e: Exception) {
                e.printStackTrace()
                runOnUiThread {
                    Toast.makeText(this@LoginActivity, "Erro de conexão: ${'$'}{e.message}", Toast.LENGTH_SHORT).show()
                }
            }
        }
    }
}
