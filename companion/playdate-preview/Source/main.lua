import "CoreLibs/graphics"
import "CoreLibs/keyboard"

local gfx <const> = playdate.graphics
local net <const> = playdate.network
local keyboard <const> = playdate.keyboard

local HEADER_BYTES <const> = 24
local FRAME_BYTES <const> = 12000
local SETTINGS_FILE <const> = "settings"
local DEFAULT_HOST <const> = "127.0.0.1"
local DEFAULT_PORT <const> = "9138"
local DEFAULT_SESSION <const> = "ABC123"

local config = playdate.datastore.read(SETTINGS_FILE) or {
    host = DEFAULT_HOST,
    port = DEFAULT_PORT,
    session = DEFAULT_SESSION,
}

local tcp = nil
local rx = ""
local connected = false
local connecting = false
local handshake = false
local reconnectRequested = true
local reconnectAfterMs = 0
local openTcpRequested = false
local closingTcp = false
local status = "Press A to connect"
local latestRevision = nil
local framesReceived = 0
local framesRejected = 0
local lastFrameMs = nil
local showOverlay = true
local pendingKeyboardField = nil
local keyboardOpen = false

playdate.display.setRefreshRate(30)

local menu = playdate.getSystemMenu()
menu:addMenuItem("Edit Host", function()
    pendingKeyboardField = "host"
end)
menu:addMenuItem("Edit Port", function()
    pendingKeyboardField = "port"
end)
menu:addMenuItem("Edit Session", function()
    pendingKeyboardField = "session"
end)
menu:addMenuItem("Reset Settings", function()
    config = { host = DEFAULT_HOST, port = DEFAULT_PORT, session = DEFAULT_SESSION }
    playdate.datastore.write(config, SETTINGS_FILE, true)
    requestReconnect("Settings reset")
end)

local function closeTcpQuietly()
    if tcp then
        closingTcp = true
        tcp:close()
        tcp = nil
    end
end

function requestReconnect(message, delayMs)
    closeTcpQuietly()
    rx = ""
    connected = false
    connecting = false
    handshake = false
    reconnectRequested = true
    reconnectAfterMs = playdate.getCurrentTimeMilliseconds() + (delayMs or 0)
    openTcpRequested = false
    status = message or "Reconnect requested"
end

local function stopConnection(message)
    closeTcpQuietly()
    rx = ""
    connected = false
    connecting = false
    handshake = false
    reconnectRequested = false
    reconnectAfterMs = 0
    openTcpRequested = false
    status = message or "Connection stopped"
end

local function saveConfig()
    config.session = string.upper(config.session or "")
    playdate.datastore.write(config, SETTINGS_FILE, true)
end

local function beginKeyboard(field)
    keyboardOpen = true
    keyboard.keyboardWillHideCallback = function(ok)
        if ok then
            config[field] = keyboard.text
            saveConfig()
            requestReconnect("Updated " .. field)
        end
        keyboardOpen = false
        pendingKeyboardField = nil
    end
    keyboard.show(config[field] or "")
end

local function u16At(text, offset)
    local a, b = string.byte(text, offset, offset + 1)
    if not a or not b then return nil end
    return a * 256 + b
end

local function u32At(text, offset)
    local a, b, c, d = string.byte(text, offset, offset + 3)
    if not a or not b or not c or not d then return nil end
    return (((a * 256 + b) * 256 + c) * 256 + d)
end

local function processPackets()
    while #rx >= HEADER_BYTES do
        local magic = string.sub(rx, 1, 4)
        if magic ~= "PDPS" then
            local nextMagic = string.find(rx, "PDPS", 2, true)
            if nextMagic then
                rx = string.sub(rx, nextMagic)
            else
                rx = ""
                status = "Waiting for frame sync"
                return
            end
        end

        if #rx < HEADER_BYTES then return end

        local headerBytes = u16At(rx, 7)
        local payloadBytes = u32At(rx, 17)
        if headerBytes ~= HEADER_BYTES or payloadBytes ~= FRAME_BYTES then
            rx = string.sub(rx, 2)
            framesRejected += 1
            status = "Rejected malformed frame"
        else
            local packetBytes = headerBytes + payloadBytes
            if #rx < packetBytes then return end

            local packet = string.sub(rx, 1, packetBytes)
            rx = string.sub(rx, packetBytes + 1)

            local ok, result = playdate.applyPDPSFrame(packet)
            if ok then
                latestRevision = result
                framesReceived += 1
                lastFrameMs = playdate.getCurrentTimeMilliseconds()
                status = "Streaming"
            else
                framesRejected += 1
                status = result
            end
        end
    end
end

local function readTcp()
    if not tcp or not connected then return end

    local available = tcp:getBytesAvailable()
    while available and available > 0 do
        local chunk, count = tcp:read(available)
        if chunk and count and count > 0 then
            rx = rx .. chunk
        end
        available = tcp:getBytesAvailable()
    end

    if not handshake then
        local lineEnd = string.find(rx, "\n", 1, true)
        if lineEnd then
            local line = string.sub(rx, 1, lineEnd - 1)
            rx = string.sub(rx, lineEnd + 1)
            if string.sub(line, 1, 2) == "OK" then
                handshake = true
                status = "Waiting for frames"
            else
                stopConnection("Session rejected; edit session")
            end
        end
    end

    if handshake then
        processPackets()
    end
end

local function openTcp()
    openTcpRequested = false
    connecting = true
    status = "Opening TCP"
    tcp = net.tcp.new(config.host, tonumber(config.port) or 9138, false, "Playdate Pixel Studio")
    if not tcp then
        stopConnection("Network access denied")
        return
    end

    tcp:setConnectTimeout(5)
    tcp:setReadTimeout(0)
    tcp:setReadBufferSize(65536)
    tcp:setConnectionClosedCallback(function()
        if closingTcp then
            closingTcp = false
            return
        end
        requestReconnect("Bridge closed connection", 1500)
    end)

    tcp:open(function(success, err)
        connecting = false
        if not success then
            stopConnection(err or "TCP connection failed")
            return
        end

        connected = true
        status = "Authenticating"
        local wrote, writeErr = tcp:write("HELLO " .. string.upper(config.session or "") .. "\n")
        if not wrote then
            stopConnection(writeErr or "Unable to write HELLO")
        end
    end)
end

local function connect()
    reconnectRequested = false
    openTcpRequested = false
    connecting = true
    status = "Enabling Wi-Fi"
    net.setEnabled(true, function(err)
        if err then
            connecting = false
            status = err
            return
        end
        connecting = false
        openTcpRequested = true
        status = "Wi-Fi ready"
    end)
end

local function drawOverlay()
    if not showOverlay then return end

    gfx.setColor(gfx.kColorWhite)
    gfx.fillRect(0, 0, 400, 54)
    gfx.setColor(gfx.kColorBlack)
    gfx.drawRect(0, 0, 400, 54)

    local frameAge = "--"
    if lastFrameMs then
        frameAge = tostring(playdate.getCurrentTimeMilliseconds() - lastFrameMs) .. " ms"
    end

    local text = string.format(
        "PD Pixel Preview  %s:%s  %s\nSession %s  Rev %s  Frames %i  Rejected %i  Age %s",
        config.host,
        config.port,
        status,
        string.upper(config.session or ""),
        latestRevision or "--",
        framesReceived,
        framesRejected,
        frameAge
    )
    gfx.drawTextInRect(text, 6, 5, 388, 46)
end

function playdate.update()
    if pendingKeyboardField and not keyboardOpen then
        beginKeyboard(pendingKeyboardField)
    end

    if reconnectRequested
        and not connecting
        and not keyboardOpen
        and playdate.getCurrentTimeMilliseconds() >= reconnectAfterMs
    then
        connect()
    end

    if openTcpRequested and not connecting and not keyboardOpen then
        openTcp()
    end

    readTcp()

    gfx.clear(gfx.kColorWhite)
    local frame = playdate.getPDPSFrame()
    if frame then
        frame:draw(0, 0)
    end
    drawOverlay()
end

function playdate.AButtonDown()
    requestReconnect("Manual reconnect")
end

function playdate.BButtonDown()
    showOverlay = not showOverlay
end
