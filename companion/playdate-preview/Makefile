HEAP_SIZE      = 8388208
STACK_SIZE     = 61800

PRODUCT = playdate-pixel-preview.pdx

SDK = ${PLAYDATE_SDK_PATH}
ifeq ($(SDK),)
SDK = $(shell egrep '^\s*SDKRoot' ~/.Playdate/config | head -n 1 | cut -c9-)
endif

ifeq ($(SDK),)
SDK = /Users/davidwallin/Developer/PlaydateSDK
endif

ifeq ($(wildcard $(SDK)/C_API/buildsupport/common.mk),)
SDK := $(patsubst %/export,%,$(SDK))
endif

export PLAYDATE_SDK_PATH := $(SDK)

SRC = main.c
UINCDIR =
UASRC =
UDEFS =
UADEFS =
ULIBDIR =
ULIBS =

include $(SDK)/C_API/buildsupport/common.mk
