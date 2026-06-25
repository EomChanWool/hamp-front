import { Swiper, SwiperSlide } from "swiper/react";
import { Navigation, Autoplay } from "swiper/modules";
import { useRef } from "react";
import type { SwiperRef } from "swiper/react";
import "swiper/css";

import { mesScreens } from "../../data/mesScreens";
import { KpiGrid } from "../../components/kpi/KpiGrid";
import { useRealtimePulse } from "../../hooks/useRealtimePulse";
import { ChevronLeftIcon, ChevronRightIcon } from "@heroicons/react/16/solid";

const DEF = mesScreens.facilityAccessRealtime;

const ACCESS_DUMMY = [
  { id: 1, name: "홍길동", dept: "생산1팀", time: "2025.06.25 14:47:00", img: "https://placekitten.com/80/80" },
  { id: 2, name: "김철수", dept: "품질관리팀", time: "2025.06.25 14:32:15", img: "https://placekitten.com/81/81" },
  { id: 3, name: "이영희", dept: "설비관리팀", time: "2025.06.25 14:21:08", img: "https://placekitten.com/82/82" },
  { id: 4, name: "박민준", dept: "물류팀", time: "2025.06.25 13:58:44", img: "https://placekitten.com/83/83" },
  { id: 5, name: "최수진", dept: "생산2팀", time: "2025.06.25 13:45:30", img: "https://placekitten.com/84/84" },
  { id: 6, name: "정태호", dept: "시스템관리팀", time: "2025.06.25 13:30:22", img: "https://placekitten.com/85/85" },
  { id: 7, name: "윤서연", dept: "연구개발팀", time: "2025.06.25 13:10:00", img: "https://placekitten.com/86/86" },
  { id: 8, name: "임재현", dept: "총무팀", time: "2025.06.25 12:55:30", img: "https://placekitten.com/87/87" },
  { id: 9, name: "한지수", dept: "생산3팀", time: "2025.06.25 12:40:15", img: "https://placekitten.com/88/88" },
];

export function FacilityAccessRealtimePage() {
  const { pulse } = useRealtimePulse(true);
  const swiperRef = useRef<SwiperRef>(null);

  return (
    <section className="screenStack">
      {DEF.kpis && <KpiGrid kpis={DEF.kpis} pulse={pulse} />}

      <div className="accessSwiperWrap">
        <Swiper
          ref={swiperRef}
          modules={[Navigation, Autoplay]}
          slidesPerView={4}
          spaceBetween={16}
          rewind
          loopAdditionalSlides={4}
          autoplay={{ delay: 5000, disableOnInteraction: false }}
          className="accessSwiper"
        >
          {ACCESS_DUMMY.map((item) => (
            <SwiperSlide key={item.id}>
              <div className="accessItem">
                <div className="imgBox">
                  <img src={item.img} alt={item.name} />
                </div>
                <div className="accessInfoBox">
                  <div className="accessInfoName">
                    <span className="accessInfoLabel">이름</span>
                    <strong>{item.name}</strong>
                  </div>
                  <div className="accessInfoMeta">
                    <span>{item.dept}</span>
                    <span className="accessInfoDot" />
                    <span>{item.time}</span>
                  </div>
                </div>
              </div>
            </SwiperSlide>
          ))}
        </Swiper>
        <div className="accessSwiperBtnBox">
          <button type="button" className="accessSwiperBtn prev" onClick={() => swiperRef.current?.swiper.slidePrev()}>
            <ChevronLeftIcon className="w-4 h-4" />
          </button>
          <button type="button" className="accessSwiperBtn next" onClick={() => swiperRef.current?.swiper.slideNext()}>
            <ChevronRightIcon className="w-4 h-4" />
          </button>
        </div>
      </div>
    </section>
  );
}
