import AVFoundation
import PhotosUI
import UIKit

// Only user-selected/captured images. No library enumeration or photo-library writes.
final class PhotoPicker: NSObject, PHPickerViewControllerDelegate, UIImagePickerControllerDelegate, UINavigationControllerDelegate, UIAdaptivePresentationControllerDelegate {
  private var completion: ((Result<[String: Any]?, Error>) -> Void)?

  func present(source: String, from controller: UIViewController, completion: @escaping (Result<[String: Any]?, Error>) -> Void) {
    guard self.completion == nil else { completion(.failure(PlanError.cancelled)); return }
    self.completion = completion
    if source == "library" {
      var config = PHPickerConfiguration()
      config.filter = .images
      config.selectionLimit = 1
      let picker = PHPickerViewController(configuration: config)
      picker.delegate = self
      controller.present(picker, animated: true)
      picker.presentationController?.delegate = self
    } else if source == "camera" && UIImagePickerController.isSourceTypeAvailable(.camera) {
      AVCaptureDevice.requestAccess(for: .video) { allowed in
        DispatchQueue.main.async {
          guard allowed else { self.finish(.failure(PlanError.cancelled)); return }
          let picker = UIImagePickerController()
          picker.sourceType = .camera
          picker.delegate = self
          controller.present(picker, animated: true)
        }
      }
    } else { finish(.failure(PlanError.invalidCallback)) }
  }

  func picker(_ picker: PHPickerViewController, didFinishPicking results: [PHPickerResult]) {
    picker.dismiss(animated: true)
    guard let selected = results.first else { finish(.success(nil)); return }
    guard selected.itemProvider.canLoadObject(ofClass: UIImage.self) else { finish(.failure(PlanError.invalidCallback)); return }
    selected.itemProvider.loadObject(ofClass: UIImage.self) { object, _ in
      DispatchQueue.main.async {
        guard let image = object as? UIImage else { self.finish(.failure(PlanError.invalidCallback)); return }
        self.encode(image)
      }
    }
  }

  func imagePickerControllerDidCancel(_ picker: UIImagePickerController) {
    picker.dismiss(animated: true)
    finish(.success(nil))
  }

  func presentationControllerDidDismiss(_ presentationController: UIPresentationController) {
    finish(.success(nil))
  }

  func imagePickerController(_ picker: UIImagePickerController, didFinishPickingMediaWithInfo info: [UIImagePickerController.InfoKey: Any]) {
    picker.dismiss(animated: true)
    guard let image = info[.originalImage] as? UIImage else { finish(.failure(PlanError.invalidCallback)); return }
    encode(image)
  }

  private func encode(_ image: UIImage) {
    guard image.size.width > 0, image.size.height > 0 else { finish(.failure(PlanError.invalidCallback)); return }
    let ratio = min(1, 1600 / max(image.size.width, image.size.height))
    let size = CGSize(width: max(1, image.size.width * ratio), height: max(1, image.size.height * ratio))
    let format = UIGraphicsImageRendererFormat()
    format.scale = 1
    format.opaque = true
    let resized = UIGraphicsImageRenderer(size: size, format: format).image { context in
      UIColor.white.setFill()
      context.fill(CGRect(origin: .zero, size: size))
      image.draw(in: CGRect(origin: .zero, size: size))
    }
    guard let data = resized.jpegData(compressionQuality: 0.8), data.count <= 4 * 1024 * 1024 else {
      finish(.failure(PlanError.invalidCallback)); return
    }
    finish(.success(["dataURL": "data:image/jpeg;base64,\(data.base64EncodedString())", "width": Int(size.width), "height": Int(size.height)]))
  }

  private func finish(_ value: Result<[String: Any]?, Error>) {
    let callback = completion
    completion = nil
    callback?(value)
  }
}
