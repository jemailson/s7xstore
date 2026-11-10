package com.s7x.proxyapp

import android.os.Bundle
import android.widget.Button
import android.widget.CompoundButton
import android.widget.Switch
import android.widget.Toast
import androidx.appcompat.app.AppCompatActivity

class MainActivity : AppCompatActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_main)

        val swInstant = findViewById<Switch>(R.id.swInstant)
        val swSpeed = findViewById<Switch>(R.id.swSpeed)
        val swHighJump = findViewById<Switch>(R.id.swHighJump)
        val btnInject = findViewById<Button>(R.id.btnInject)

        val listener = CompoundButton.OnCheckedChangeListener { btn, isChecked ->
            Toast.makeText(this, "${'$'}{btn.tag}: ${'$'}{if (isChecked) "ON" else "OFF"}", Toast.LENGTH_SHORT).show()
        }

        swInstant.setOnCheckedChangeListener(listener)
        swSpeed.setOnCheckedChangeListener(listener)
        swHighJump.setOnCheckedChangeListener(listener)

        btnInject.setOnClickListener {
            Toast.makeText(this, "Injetando...", Toast.LENGTH_SHORT).show()
        }
    }
}
