#include <stdint.h>
#include <stdlib.h>
#include <string.h>

#include "pd_api.h"

#define PDPS_WIDTH 400
#define PDPS_HEIGHT 240
#define PDPS_HEADER_BYTES 24
#define PDPS_PAYLOAD_BYTES 12000
#define PDPS_SOURCE_ROW_BYTES 50
#define PDPS_VERSION 1

static PlaydateAPI* pd = NULL;
static LCDBitmap* frameBitmap = NULL;

static int pdps_apply_frame(lua_State* L);
static int pdps_get_frame(lua_State* L);
static uint16_t read_u16_be(const uint8_t* bytes);
static uint32_t read_u32_be(const uint8_t* bytes);
static uint32_t crc32_bytes(const uint8_t* bytes, size_t length);
static void push_error(const char* message);

#ifdef _WINDLL
__declspec(dllexport)
#endif
int eventHandler(PlaydateAPI* playdate, PDSystemEvent event, uint32_t arg)
{
	(void)arg;

	if (event == kEventInitLua)
	{
		pd = playdate;

		const char* err;
		if (!pd->lua->addFunction(pdps_apply_frame, "playdate.applyPDPSFrame", &err))
			pd->system->logToConsole("playdate.applyPDPSFrame failed: %s", err);
		if (!pd->lua->addFunction(pdps_get_frame, "playdate.getPDPSFrame", &err))
			pd->system->logToConsole("playdate.getPDPSFrame failed: %s", err);
	}
	else if (event == kEventTerminate)
	{
		if (frameBitmap)
		{
			pd->graphics->freeBitmap(frameBitmap);
			frameBitmap = NULL;
		}
	}

	return 0;
}

static int pdps_apply_frame(lua_State* L)
{
	size_t length = 0;
	const uint8_t* bytes = (const uint8_t*)pd->lua->getArgBytes(1, &length);
	if (!bytes || length < PDPS_HEADER_BYTES)
	{
		push_error("Frame packet is too short");
		return 2;
	}

	if (memcmp(bytes, "PDPS", 4) != 0)
	{
		push_error("Invalid frame magic");
		return 2;
	}

	if (bytes[4] != PDPS_VERSION)
	{
		push_error("Unsupported frame version");
		return 2;
	}

	const uint16_t headerBytes = read_u16_be(bytes + 6);
	const uint16_t width = read_u16_be(bytes + 8);
	const uint16_t height = read_u16_be(bytes + 10);
	const uint32_t revision = read_u32_be(bytes + 12);
	const uint32_t payloadBytes = read_u32_be(bytes + 16);
	const uint32_t expectedCrc = read_u32_be(bytes + 20);

	if (headerBytes != PDPS_HEADER_BYTES || width != PDPS_WIDTH || height != PDPS_HEIGHT)
	{
		push_error("Unsupported frame shape");
		return 2;
	}

	if (payloadBytes != PDPS_PAYLOAD_BYTES || length != PDPS_HEADER_BYTES + PDPS_PAYLOAD_BYTES)
	{
		push_error("Invalid frame payload length");
		return 2;
	}

	const uint8_t* payload = bytes + PDPS_HEADER_BYTES;
	if (crc32_bytes(payload, payloadBytes) != expectedCrc)
	{
		push_error("Frame CRC failed");
		return 2;
	}

	if (!frameBitmap)
		frameBitmap = pd->graphics->newBitmap(PDPS_WIDTH, PDPS_HEIGHT, kColorWhite);

	if (!frameBitmap)
	{
		push_error("Unable to allocate frame bitmap");
		return 2;
	}

	int bitmapWidth;
	int bitmapHeight;
	int rowbytes;
	uint8_t* mask;
	uint8_t* data;
	pd->graphics->getBitmapData(frameBitmap, &bitmapWidth, &bitmapHeight, &rowbytes, &mask, &data);
	(void)mask;

	if (bitmapWidth != PDPS_WIDTH || bitmapHeight != PDPS_HEIGHT || rowbytes < PDPS_SOURCE_ROW_BYTES)
	{
		push_error("Unexpected bitmap layout");
		return 2;
	}

	for (int y = 0; y < PDPS_HEIGHT; y++)
	{
		uint8_t* targetRow = data + (rowbytes * y);
		const uint8_t* sourceRow = payload + (PDPS_SOURCE_ROW_BYTES * y);
		memcpy(targetRow, sourceRow, PDPS_SOURCE_ROW_BYTES);
		if (rowbytes > PDPS_SOURCE_ROW_BYTES)
			memset(targetRow + PDPS_SOURCE_ROW_BYTES, 0, (size_t)(rowbytes - PDPS_SOURCE_ROW_BYTES));
	}

	pd->lua->pushBool(1);
	pd->lua->pushInt((int)revision);
	return 2;
}

static int pdps_get_frame(lua_State* L)
{
	(void)L;

	if (!frameBitmap)
		frameBitmap = pd->graphics->newBitmap(PDPS_WIDTH, PDPS_HEIGHT, kColorWhite);

	if (!frameBitmap)
	{
		pd->lua->pushNil();
		return 1;
	}

	pd->lua->pushBitmap(frameBitmap);
	return 1;
}

static void push_error(const char* message)
{
	pd->lua->pushBool(0);
	pd->lua->pushString(message);
}

static uint16_t read_u16_be(const uint8_t* bytes)
{
	return (uint16_t)((bytes[0] << 8) | bytes[1]);
}

static uint32_t read_u32_be(const uint8_t* bytes)
{
	return ((uint32_t)bytes[0] << 24) |
		   ((uint32_t)bytes[1] << 16) |
		   ((uint32_t)bytes[2] << 8) |
		   (uint32_t)bytes[3];
}

static uint32_t crc32_bytes(const uint8_t* bytes, size_t length)
{
	uint32_t crc = 0xffffffff;
	for (size_t i = 0; i < length; i++)
	{
		crc ^= bytes[i];
		for (int bit = 0; bit < 8; bit++)
		{
			const uint32_t mask = (uint32_t)-(int32_t)(crc & 1);
			crc = (crc >> 1) ^ (0xedb88320 & mask);
		}
	}
	return crc ^ 0xffffffff;
}
