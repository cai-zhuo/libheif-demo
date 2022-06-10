# 需要提前在设置 Docker 客户端设置共享文件夹的目录 /tmp/libheif

FROM ubuntu:focal

ENV EMSCRIPTEN_VERSION=1.37.26

ENV TZ=Asia/Shanghai

ENV DEBIAN_FRONTEND=noninteractive

# 安装所需依赖
RUN apt-get update && apt-get install -y sudo git python2 pkg-config m4 libtool automake autoconf lsb-core curl

RUN git clone --depth=1 https://github.com/strukturag/libheif.git

WORKDIR /libheif

RUN ln -s /usr/bin/python2 /usr/bin/python

RUN ./scripts/install-ci-linux.sh

RUN ./scripts/prepare-ci.sh

RUN ./scripts/run-ci.sh

COPY ./copy-js-to-host.sh ./copy-js-to-host.sh

