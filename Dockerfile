# 需要提前在设置 Docker 客户端设置共享文件夹的目录 /tmp/libheif

FROM ubuntu:focal

ENV EMSCRIPTEN_VERSION=1.37.26

ENV TZ=Asia/Shanghai

ENV DEBIAN_FRONTEND=noninteractive

# 安装所需依赖
RUN apt-get update && apt-get install -y sudo git python2 pkg-config m4 libtool automake autoconf lsb-core curl

RUN ln -s /usr/bin/python2 /usr/bin/python

RUN git clone --depth=1 https://github.com/strukturag/libheif.git

WORKDIR /libheif

RUN ./scripts/install-ci-linux.sh

RUN ./scripts/prepare-ci.sh

COPY ./lib/libheif/post.js /libheif/post.js

COPY ./lib/libheif/libheif/heif_emscripten.h /libheif/libheif/heif_emscripten.h

COPY ./lib/libheif/build-emscripten.sh /libheif/build-emscripten.sh

# COPY ./lib/libheif/scripts/run-ci.sh /libheif/scripts/run-ci.sh

RUN ./scripts/run-ci.sh

COPY ./copy-js-to-host.sh ./copy-js-to-host.sh
