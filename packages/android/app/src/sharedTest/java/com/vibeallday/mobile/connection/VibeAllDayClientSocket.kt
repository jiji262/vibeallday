package com.vibeallday.mobile.connection

import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.Response
import okhttp3.WebSocket
import okhttp3.WebSocketListener
import okio.ByteString

interface VibeAllDayClientSocket {
    fun queueSize(): Long
    fun send(text: String): Boolean
    fun send(bytes: ByteString): Boolean
    fun close(code: Int, reason: String): Boolean
    fun cancel()
}

interface VibeAllDayClientSocketListener {
    /**
     * `relayPaired` is true for direct sockets and mux circuits. A legacy relay
     * `/ws` socket still needs the plaintext `client_connect` exchange.
     */
    fun onOpen(socket: VibeAllDayClientSocket, relayPaired: Boolean)
    fun onText(socket: VibeAllDayClientSocket, text: String)
    fun onBytes(socket: VibeAllDayClientSocket, bytes: ByteString)
    fun onClosing(socket: VibeAllDayClientSocket, code: Int, reason: String)
    fun onClosed(socket: VibeAllDayClientSocket, code: Int, reason: String)
    fun onFailure(socket: VibeAllDayClientSocket, error: Throwable)
}

interface VibeAllDayClientSocketConnector {
    fun open(
        websocketUrl: String,
        relayTarget: String?,
        listener: VibeAllDayClientSocketListener,
    ): VibeAllDayClientSocket
}

class VibeAllDayOkHttpClientSocketConnector(
    private val httpClient: OkHttpClient,
) : VibeAllDayClientSocketConnector {
    override fun open(
        websocketUrl: String,
        relayTarget: String?,
        listener: VibeAllDayClientSocketListener,
    ): VibeAllDayClientSocket {
        lateinit var adapter: OkHttpClientSocket
        val webSocket = httpClient.newWebSocket(
            Request.Builder().url(websocketUrl).build(),
            object : WebSocketListener() {
                override fun onOpen(webSocket: WebSocket, response: Response) {
                    listener.onOpen(adapter, relayPaired = relayTarget == null)
                }

                override fun onMessage(webSocket: WebSocket, text: String) {
                    listener.onText(adapter, text)
                }

                override fun onMessage(webSocket: WebSocket, bytes: ByteString) {
                    listener.onBytes(adapter, bytes)
                }

                override fun onClosing(webSocket: WebSocket, code: Int, reason: String) {
                    listener.onClosing(adapter, code, reason)
                }

                override fun onClosed(webSocket: WebSocket, code: Int, reason: String) {
                    listener.onClosed(adapter, code, reason)
                }

                override fun onFailure(
                    webSocket: WebSocket,
                    t: Throwable,
                    response: Response?,
                ) {
                    listener.onFailure(adapter, t)
                }
            },
        )
        adapter = OkHttpClientSocket(webSocket)
        return adapter
    }

    private class OkHttpClientSocket(
        private val socket: WebSocket,
    ) : VibeAllDayClientSocket {
        override fun queueSize(): Long = socket.queueSize()
        override fun send(text: String): Boolean = socket.send(text)
        override fun send(bytes: ByteString): Boolean = socket.send(bytes)
        override fun close(code: Int, reason: String): Boolean = socket.close(code, reason)
        override fun cancel() = socket.cancel()
    }
}
